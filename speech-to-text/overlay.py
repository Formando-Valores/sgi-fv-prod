import tkinter as tk
from tkinter import ttk
import speech_recognition as sr
import threading
import pyperclip
import json
import os
import sys
import webbrowser
import subprocess
import datetime
from pathlib import Path
import ctypes
import re

try:
    import pyttsx3
    TTS_AVAILABLE = True
except Exception:
    TTS_AVAILABLE = False


SITES = {
    "vercel": "https://vercel.com",
    "supabase": "https://supabase.com",
    "github": "https://github.com",
    "google": "https://google.com",
    "youtube": "https://youtube.com",
    "gmail": "https://mail.google.com",
    "chatgpt": "https://chatgpt.com",
    "chat gpt": "https://chatgpt.com",
    "deepseek": "https://chat.deepseek.com",
    "opencode": "https://opencode.ai",
    "claude": "https://claude.ai",
    "stack overflow": "https://stackoverflow.com",
    "npm": "https://npmjs.com",
    "pip": "https://pypi.org",
    "python": "https://python.org",
    "node": "https://nodejs.org",
}

APPS = {
    "opencode": None,
    "vscode": "code",
    "visual studio": "code",
    "visual studio code": "code",
    "terminal": "powershell",
    "cmd": "cmd",
    "powershell": "powershell",
    "calculadora": "calc",
    "bloco de notas": "notepad",
    "notepad": "notepad",
    "explorador de arquivos": "explorer",
    "explorer": "explorer",
    "chrome": "chrome",
    "edge": "msedge",
    "firefox": "firefox",
    "spotify": "spotify",
    "discord": "discord",
    "slack": "slack",
    "figma": "figma",
    "postman": "postman",
}


CONFIG_FILE = Path(__file__).parent / "config.json"

DEFAULT_CONFIG = {
    "always_on_top": True,
    "opacity": 0.9,
    "click_through": False,
    "energy_threshold": 3000,
    "pause_threshold": 0.8,
    "language": "pt-BR",
    "engine": "google",
    "compact_mode": False,
    "command_mode": True
}

WS_EX_TRANSPARENT = 0x00000020
WS_EX_LAYERED = 0x00080000
WS_EX_TOOLWINDOW = 0x00000080
GWL_EXSTYLE = -20


class FloatingOverlay:
    def __init__(self, root):
        self.root = root
        self.config = self.load_config()
        self.recognizer = sr.Recognizer()
        self.recognizer.energy_threshold = self.config.get("energy_threshold", 3000)
        self.recognizer.pause_threshold = self.config.get("pause_threshold", 0.8)
        self.is_listening = False
        self.listener_thread = None
        self.click_through_enabled = self.config.get("click_through", False)
        self.compact = self.config.get("compact_mode", False)
        self.command_mode = self.config.get("command_mode", True)
        self.last_text = ""
        self.full_text = ""
        self._hover_check_id = None
        self._conversation_active = False
        self._first_command = True
        self._tts_engine = None
        if TTS_AVAILABLE:
            try:
                self._tts_engine = pyttsx3.init()
                self._tts_engine.setProperty("rate", 170)
                voices = self._tts_engine.getProperty("voices")
                for v in voices:
                    if "portuguese" in v.name.lower() or "brazil" in v.name.lower():
                        self._tts_engine.setProperty("voice", v.id)
                        break
            except Exception:
                self._tts_engine = None

        self.setup_window()
        self.setup_ui()
        self.root.withdraw()
        self.root.deiconify()
        self.start_hover_check()
        if self.command_mode:
            self.root.after(500, self._ativar_assistente)

    def load_config(self):
        if CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    return {**DEFAULT_CONFIG, **json.load(f)}
            except Exception:
                return DEFAULT_CONFIG.copy()
        return DEFAULT_CONFIG.copy()

    def save_config(self):
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(self.config, f, indent=2, ensure_ascii=False)

    def setup_window(self):
        title = "Fala para Texto"
        self.root.title(title)
        self.root.overrideredirect(True)
        self.root.attributes("-topmost", True)
        self.root.attributes("-alpha", self.config.get("opacity", 0.9))
        self.root.configure(bg="#1e1e2e")

        self.root.geometry("360x200+100+100")
        self.root.minsize(200, 100)

        hwnd = ctypes.windll.user32.GetParent(self.root.winfo_id())
        style = ctypes.windll.user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
        style |= WS_EX_TOOLWINDOW
        ctypes.windll.user32.SetWindowLongW(hwnd, GWL_EXSTYLE, style)

        self.root.bind("<Button-1>", self.start_move)
        self.root.bind("<B1-Motion>", self.on_move)
        self.root.bind("<ButtonRelease-1>", self.stop_move)
        self.root.bind("<Button-3>", self.show_context_menu)


    def setup_ui(self):
        self.container = tk.Frame(self.root, bg="#1e1e2e", highlightthickness=1, highlightbackground="#313244")
        self.container.pack(fill=tk.BOTH, expand=True, padx=1, pady=1)

        self.top_bar = tk.Frame(self.container, bg="#1e1e2e", height=28)
        self.top_bar.pack(fill=tk.X, padx=4, pady=(2, 0))
        self.top_bar.pack_propagate(False)

        self.mic_btn = tk.Button(
            self.top_bar, text="🎤", font=("Segoe UI", 12),
            bg="#1e1e2e", fg="#a6e3a1", relief=tk.FLAT,
            activebackground="#313244", activeforeground="#a6e3a1",
            bd=0, padx=4, cursor="hand2",
            command=self.toggle_listening
        )
        self.mic_btn.pack(side=tk.LEFT, padx=(2, 4))
        self.mic_btn.bind("<Button-1>", lambda e: (self.stop_move(e), self.toggle_listening()))

        self.status_dot = tk.Canvas(self.top_bar, width=8, height=8,
                                     bg="#1e1e2e", highlightthickness=0)
        self.status_dot.pack(side=tk.LEFT, padx=(0, 4))
        self.dot = self.status_dot.create_oval(1, 1, 7, 7, fill="#585b70", outline="")

        self.text_label = tk.Label(
            self.top_bar, text="Pronto", font=("Segoe UI", 10),
            bg="#1e1e2e", fg="#6c7086", anchor=tk.W, padx=4
        )
        self.text_label.pack(side=tk.LEFT, fill=tk.X, expand=True)

        self.mode_btn = tk.Button(
            self.top_bar, text="🤖", font=("Segoe UI", 10),
            bg="#1e1e2e", fg="#89b4fa", relief=tk.FLAT,
            activebackground="#313244", activeforeground="#89b4fa",
            bd=0, padx=4, cursor="hand2",
            command=self.toggle_mode
        )
        self.mode_btn.pack(side=tk.RIGHT, padx=(0, 2))
        self.mode_btn.bind("<Button-1>", lambda e: (self.stop_move(e), self.toggle_mode()))

        self.copy_btn = tk.Button(
            self.top_bar, text="📋", font=("Segoe UI", 10),
            bg="#1e1e2e", fg="#585b70", relief=tk.FLAT,
            activebackground="#313244", activeforeground="#a6e3a1",
            bd=0, padx=4, cursor="hand2",
            command=self.copy_text
        )
        self.copy_btn.pack(side=tk.RIGHT, padx=(0, 2))
        self.copy_btn.bind("<Button-1>", lambda e: (self.stop_move(e), self.copy_text()))

        self.pin_btn = tk.Button(
            self.top_bar, text="📌", font=("Segoe UI", 10),
            bg="#1e1e2e", fg="#585b70", relief=tk.FLAT,
            activebackground="#313244", activeforeground="#f9e2af",
            bd=0, padx=4, cursor="hand2",
            command=self.toggle_click_through
        )
        self.pin_btn.pack(side=tk.RIGHT, padx=(0, 2))
        self.pin_btn.bind("<Button-1>", lambda e: (self.stop_move(e), self.toggle_click_through()))

        self.close_btn = tk.Button(
            self.top_bar, text="✕", font=("Segoe UI", 10),
            bg="#1e1e2e", fg="#585b70", relief=tk.FLAT,
            activebackground="#f38ba8", activeforeground="#1e1e2e",
            bd=0, padx=4, cursor="hand2",
            command=self.on_close
        )
        self.close_btn.pack(side=tk.RIGHT, padx=(0, 2))
        self.close_btn.bind("<Button-1>", lambda e: (self.stop_move(e), self.on_close()))

        self.speech_frame = tk.Frame(self.container, bg="#1e1e2e")
        self.speech_frame.pack(fill=tk.X, padx=4, pady=(0, 2))

        self.speech_label = tk.Label(
            self.speech_frame, text="",
            font=("Segoe UI", 10),
            bg="#313244", fg="#cdd6f4",
            anchor=tk.W, padx=8, pady=4,
            wraplength=340,
            justify=tk.LEFT
        )
        self.speech_label.pack(side=tk.LEFT, fill=tk.X, expand=True)

        self.speech_copy_btn = tk.Button(
            self.speech_frame, text="📋", font=("Segoe UI", 10),
            bg="#313244", fg="#585b70", relief=tk.FLAT,
            activebackground="#45475a", activeforeground="#a6e3a1",
            bd=0, padx=6, cursor="hand2",
            command=self.copy_last_phrase
        )
        self.speech_copy_btn.pack(side=tk.RIGHT, padx=(2, 0))
        self.speech_copy_btn.bind("<Button-1>", lambda e: (self.stop_move(e), self.copy_last_phrase()))

        self.expand_frame = tk.Frame(self.container, bg="#1e1e2e")
        self.text_display = tk.Text(
            self.expand_frame,
            font=("Segoe UI", 10),
            bg="#313244", fg="#cdd6f4",
            relief=tk.FLAT, bd=0,
            height=3, width=40,
            wrap=tk.WORD,
            padx=8, pady=6,
            insertbackground="#cdd6f4",
            selectbackground="#585b70"
        )
        self.text_display.pack(fill=tk.BOTH, expand=True, padx=4, pady=(0, 4))

        self.text_display.tag_config("voce", foreground="#89b4fa")
        self.text_display.tag_config("assistente", foreground="#a6e3a1")
        self.text_display.tag_config("sistema", foreground="#6c7086")
        self.text_display.tag_config("detalhe", foreground="#585b70")

        scrollbar = tk.Scrollbar(self.text_display, bg="#313244", troughcolor="#1e1e2e")
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.text_display.config(yscrollcommand=scrollbar.set)
        scrollbar.config(command=self.text_display.yview)

    def update_height(self):
        if self.compact:
            self.root.geometry(f"360x60")
        else:
            lines = int(self.text_display.index("end-1c").split(".")[0])
            height = max(3, min(lines, 8))
            self.text_display.configure(height=height)
            self.root.geometry(f"360x{60 + height * 20 + 8}")

    def start_move(self, event):
        self._drag_data = {"x": event.x_root - self.root.winfo_x(),
                           "y": event.y_root - self.root.winfo_y()}

    def on_move(self, event):
        if hasattr(self, "_drag_data"):
            x = event.x_root - self._drag_data["x"]
            y = event.y_root - self._drag_data["y"]
            self.root.geometry(f"+{x}+{y}")

    def stop_move(self, event):
        if hasattr(self, "_drag_data"):
            del self._drag_data

    def toggle_click_through(self):
        if self.click_through_enabled:
            self.disable_click_through()
        else:
            self.enable_click_through()

    def start_hover_check(self):
        self.check_mouse_proximity()

    def check_mouse_proximity(self):
        try:
            x, y = self.root.winfo_pointerxy()
            wx = self.root.winfo_x()
            wy = self.root.winfo_y()
            ww = self.root.winfo_width()
            wh = self.root.winfo_height()
            margin = 15
            inside = (wx - margin <= x <= wx + ww + margin and
                      wy - margin <= y <= wy + wh + margin)

            if self.click_through_enabled:
                if inside:
                    self._remove_transparent()
                elif not inside:
                    self._apply_transparent()
        except Exception:
            pass
        self._hover_check_id = self.root.after(200, self.check_mouse_proximity)

    def _apply_transparent(self):
        hwnd = ctypes.windll.user32.GetParent(self.root.winfo_id())
        style = ctypes.windll.user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
        style |= WS_EX_TRANSPARENT
        ctypes.windll.user32.SetWindowLongW(hwnd, GWL_EXSTYLE, style)
        self.root.attributes("-alpha", max(0.15, self.config.get("opacity", 0.9) - 0.3))
        self.pin_btn.config(fg="#f9e2af", text="🔓")

    def _remove_transparent(self):
        hwnd = ctypes.windll.user32.GetParent(self.root.winfo_id())
        style = ctypes.windll.user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
        style &= ~WS_EX_TRANSPARENT
        ctypes.windll.user32.SetWindowLongW(hwnd, GWL_EXSTYLE, style)
        self.root.attributes("-alpha", self.config.get("opacity", 0.9))
        self.pin_btn.config(fg="#f9e2af", text="📌")

    def enable_click_through(self):
        self.click_through_enabled = True
        self.config["click_through"] = True
        self.save_config()
        self.pin_btn.config(fg="#f9e2af", text="🔓")

    def disable_click_through(self):
        self.click_through_enabled = False
        self.config["click_through"] = False
        self.save_config()
        self._remove_transparent()
        self.pin_btn.config(fg="#585b70", text="📌")

    def show_context_menu(self, event):
        menu = tk.Menu(self.root, tearoff=0, bg="#313244", fg="#cdd6f4",
                       activebackground="#45475a", activeforeground="#cdd6f4")
        menu.add_command(label="Compacto" if not self.compact else "Expandido",
                         command=self.toggle_compact)
        menu.add_separator()
        opacity_menu = tk.Menu(menu, tearoff=0, bg="#313244", fg="#cdd6f4",
                               activebackground="#45475a", activeforeground="#cdd6f4")
        for op in [0.3, 0.5, 0.7, 0.9, 1.0]:
            opacity_menu.add_command(
                label=f"{int(op * 100)}%{' ✓' if abs(self.config.get('opacity', 0.9) - op) < 0.05 else ''}",
                command=lambda v=op: self.set_opacity(v)
            )
        menu.add_cascade(label="Opacidade", menu=opacity_menu)
        menu.add_separator()
        menu.add_command(label="Sair", command=self.on_close)
        try:
            menu.tk_popup(event.x_root, event.y_root)
        finally:
            menu.grab_release()

    def toggle_compact(self):
        self.compact = not self.compact
        self.config["compact_mode"] = self.compact
        self.save_config()
        if self.compact:
            self.expand_frame.pack_forget()
            self.root.geometry("360x80")
        else:
            self.expand_frame.pack(fill=tk.BOTH, expand=True)
            self.update_height()

    def set_opacity(self, value):
        self.config["opacity"] = value
        self.save_config()
        self.root.attributes("-alpha", value)
        if self.click_through_enabled:
            self.root.attributes("-alpha", max(0.15, value - 0.3))

    def toggle_listening(self):
        if self.is_listening:
            self.stop_listening()
        else:
            self.start_listening()

    def start_listening(self):
        self.is_listening = True
        self.mic_btn.config(text="⏹️", fg="#f38ba8")
        self.status_dot.itemconfig(self.dot, fill="#a6e3a1")
        mode = "Comando" if self.command_mode else "Texto"
        self.text_label.config(text=f"Ouvindo ({mode})...", fg="#a6e3a1")
        self.listener_thread = threading.Thread(target=self.listen_loop, daemon=True)
        self.listener_thread.start()

    def stop_listening(self):
        self.is_listening = False
        self.mic_btn.config(text="🎤", fg="#a6e3a1")
        self.status_dot.itemconfig(self.dot, fill="#585b70")
        if self.full_text:
            self.text_label.config(text="Parado", fg="#f38ba8")
        else:
            self.text_label.config(text="Pronto", fg="#6c7086")

    def listen_loop(self):
        try:
            with sr.Microphone() as source:
                self.recognizer.adjust_for_ambient_noise(source, duration=0.5)
                while self.is_listening:
                    try:
                        audio = self.recognizer.listen(source, timeout=1, phrase_time_limit=8)
                        self.root.after(0, lambda: self.text_label.config(
                            text="Processando...", fg="#f9e2af"
                        ))
                        threading.Thread(target=self.transcribe_audio, args=(audio,), daemon=True).start()
                    except sr.WaitTimeoutError:
                        continue
                    except Exception as e:
                        self.root.after(0, lambda: self.text_label.config(
                            text=f"Erro: {str(e)[:20]}", fg="#f38ba8"
                        ))
        except Exception as e:
            self.root.after(0, lambda: self.text_label.config(text=f"Erro mic: {str(e)[:20]}", fg="#f38ba8"))
            self.root.after(0, self.stop_listening)

    def _fala_valida(self, text):
        text = text.strip().lower()
        if len(text) < 3:
            return False
        if text in ["o", "a", "e", "é", "tá", "ta", "um", "uma", "na", "no", "em", "de", "do", "da",
                     "pra", "pro", "que", "com", "sem", "por", "para", "sim", "não", "nao", "ok"]:
            return False
        if re.match(r"^[a-záéíóúãõç ]$", text) and len(text) <= 2:
            return False
        if re.match(r"^[a-záéíóúãõç]{1,2}$", text):
            return False
        return True

    def transcribe_audio(self, audio):
        engine = self.config.get("engine", "google")
        lang = self.config.get("language", "pt-BR")

        try:
            if engine == "google":
                text = self.recognizer.recognize_google(audio, language=lang)
            elif engine == "whisper":
                text = self.recognizer.recognize_whisper(audio, language=lang[:2])
            else:
                text = self.recognizer.recognize_google(audio, language=lang)

            if text:
                text = text.strip()
                self.last_text = text
                captured = text

                if not self._fala_valida(captured):
                    self.root.after(0, lambda t=captured: self._log_historico(f"  · ignorado: \"{t}\"", "detalhe"))
                    return

                if self.command_mode:
                    self.root.after(0, lambda t=captured: self.executar_comando(t))
                else:
                    if self.full_text:
                        self.full_text += " " + captured
                    else:
                        self.full_text = captured
                    self.root.after(0, lambda t=captured: self.update_text(t))
        except sr.UnknownValueError:
            self.root.after(0, lambda: self.text_label.config(text="Não entendi", fg="#f9e2af"))
        except sr.RequestError:
            self.root.after(0, lambda: self.text_label.config(text="Sem internet", fg="#f38ba8"))
        except Exception as e:
            self.root.after(0, lambda: self.text_label.config(text=f"Erro: {str(e)[:20]}", fg="#f38ba8"))

    def update_text(self, text):
        display = text[:50] + "..." if len(text) > 50 else text
        self.text_label.config(text=display, fg="#cdd6f4")
        self.last_text = text
        self.speech_label.config(text=text)
        self.text_display.insert(tk.END, text + "\n")
        self.text_display.see(tk.END)
        self.update_height()
        self.copy_text()
        self.root.after(0, lambda: self.text_label.config(text=display, fg="#a6e3a1"))

    def copy_text(self):
        text = self.text_display.get("1.0", tk.END).strip()
        if text:
            pyperclip.copy(text)

    def copy_last_phrase(self):
        if self.last_text:
            pyperclip.copy(self.last_text)
            orig = self.speech_label.cget("fg")
            self.speech_label.config(fg="#a6e3a1")
            self.root.after(1000, lambda: self.speech_label.config(fg="#cdd6f4"))

    def _ativar_assistente(self):
        self.mode_btn.config(text="🤖", fg="#89b4fa")
        self._first_command = True
        self._conversation_active = True
        self._log_historico("-- Assistente iniciado --", "sistema")
        self.update_height()
        self.conversar(f"{self.saudacao()}! Como posso ajudar?")
        if not self.is_listening:
            self.start_listening()

    def toggle_mode(self):
        self.command_mode = not self.command_mode
        self.config["command_mode"] = self.command_mode
        self.save_config()
        if self.command_mode:
            self._ativar_assistente()
        else:
            self.mode_btn.config(text="🎤", fg="#a6e3a1")
            self._conversation_active = False
            self.text_label.config(text="Modo: Texto", fg="#a6e3a1")
            self.root.after(2000, lambda: self.text_label.config(
                text="Ouvindo..." if self.is_listening else "Pronto",
                fg="#a6e3a1" if self.is_listening else "#6c7086"
            ))

    def show_command_feedback(self, msg, fg="#89b4fa"):
        self.speech_label.config(text=msg, fg=fg)
        self.text_label.config(text=msg[:40], fg=fg)

    def speak(self, msg):
        if self._tts_engine:
            def _say():
                try:
                    self._tts_engine.say(msg)
                    self._tts_engine.runAndWait()
                except Exception:
                    pass
            threading.Thread(target=_say, daemon=True).start()

    def saudacao(self):
        hora = datetime.datetime.now().hour
        if hora < 12:
            return "Bom dia"
        elif hora < 18:
            return "Boa tarde"
        else:
            return "Boa noite"

    def conversar(self, msg):
        self.show_command_feedback(msg, "#89b4fa")
        self._log_historico(f"Assistente > {msg}", "assistente")
        self.speak(msg)

    def executar_comando(self, text):
        self._log_historico(f"Voce > {text}", "voce")
        self.execute_command(text.lower())

    def execute_command(self, text):
        text_lower = text.lower().strip()

        if self._first_command:
            self._first_command = False

        if any(w in text_lower for w in ["tchau", "adeus", "ate logo", "só isso", "so isso",
                                          "é só", "e só", "nada mais", "por hoje é só"]):
            self.conversar("OK! Estou aqui se precisar.")
            self._conversation_active = False
            self.stop_listening()
            return

        if any(w in text_lower for w in ["obrigado", "brigado", "valeu", "thanks"]):
            self.conversar("De nada! Mais alguma coisa?")
            return

        if any(w in text_lower for w in ["sim", "quero", " continua", "pode ser", "claro", "vamos"]):
            if not self.is_listening:
                self.start_listening()
            self.conversar("O que deseja?")
            return

        if any(w in text_lower for w in ["nao", "não", "nada"]):
            if any(w in text_lower for w in ["obrigado", "brigado", "quero", "preciso"]):
                pass
            elif len(text_lower) < 10:
                self.conversar("OK! Estou aqui se precisar.")
                self._conversation_active = False
                self.stop_listening()
                return

        if any(w in text_lower for w in ["ajuda", "comandos", "help", "o que voce faz", "o que sabe"]):
            self.show_help()
            self.conversar("Fale um comando ou peca ajuda para ver a lista.")
            return

        keywords_abrir = ["abra", "abre", "abrir", "abra o", "abre o", "abra a", "abre a",
                          "inicie", "inicia", "iniciar", "inicie o", "inicie a",
                          "abra o app", "abra o programa", "abra aplicativo",
                          "vai pro", "vai para", "entra no", "entrar no"]
        keywords_digitar = ["digite", "digita", "digitar", "escreva", "escreve", "escrever",
                           "tecle", "teclar", "digite no teclado"]
        keywords_pesquisar = ["pesquise", "pesquisa", "pesquisar", "busque", "busca", "buscar",
                             "pesquise no", "pesquisa no", "busque no", "busca no",
                             "procure", "procurar", "procura"]
        keywords_fechar = ["feche", "fecha", "fechar", "feche o", "fecha o", "feche a", "fecha a"]

        for kw in keywords_fechar:
            if kw in text_lower:
                target = self._extrair_alvo(text_lower, keywords_fechar)
                if target:
                    self.fechar_app(target)
                    self.conversar("Fechado! Mais alguma coisa?")
                else:
                    self.conversar("O que devo fechar?")
                return

        for kw in keywords_digitar:
            if kw in text_lower:
                target = self._extrair_alvo(text, keywords_digitar)
                if target:
                    self.digitar_texto(target)
                    self.conversar("Digitado! Mais alguma coisa?")
                else:
                    self.conversar("O que devo digitar?")
                return

        for kw in keywords_pesquisar:
            if kw in text_lower:
                target = self._extrair_alvo(text_lower, keywords_pesquisar)
                if target:
                    self.pesquisar_web(target)
                    self.conversar("Pesquisa aberta! Mais alguma coisa?")
                else:
                    self.pesquisar_web(text_lower)
                    self.conversar("Pesquisa aberta! Mais alguma coisa?")
                return

        for kw in keywords_abrir:
            if kw in text_lower:
                target = self._extrair_alvo(text_lower, keywords_abrir)
                if target:
                    self.abrir_alvo(target)
                else:
                    self.conversar("O que devo abrir?")
                return

        if any(w in text_lower for w in ["clique em", "clique no", "clique na", "clicar em"]):
            for p in ["clique em ", "clique no ", "clique na ", "clicar em "]:
                if p in text_lower:
                    target = text_lower.split(p, 1)[-1].strip()
                    self.show_command_feedback(f"Clique em '{target}' - use mouse", "#f9e2af")
                    self.conversar("Use o mouse para clicar. Mais alguma coisa?")
                    return

        self.tentar_app_ou_site(text_lower)

    def _extrair_alvo(self, text_original, keywords):
        text_lower = text_original.lower()
        for kw in sorted(keywords, key=len, reverse=True):
            idx = text_lower.find(kw)
            if idx >= 0:
                resto = text_original[idx + len(kw):].strip()
                resto = re.sub(r"^(o |a |os |as |no |na |em |para |pro |pra |por favor|pfv |me )",
                              "", resto, flags=re.I).strip()
                if not resto:
                    return None
                palavras = resto.split()
                for i in range(len(palavras), 0, -1):
                    candidato = " ".join(palavras[:i]).lower()
                    if candidato in SITES or candidato in APPS:
                        return " ".join(palavras[:i])
                return palavras[0].strip(".,!?;:")
        return None

    def _abrir_url(self, url):
        try:
            webbrowser.open(url)
            return True
        except Exception:
            pass
        try:
            os.startfile(url)
            return True
        except Exception:
            pass
        try:
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            subprocess.Popen(f'start "" "{url}"', shell=True, startupinfo=startupinfo,
                           stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
            return True
        except Exception:
            pass
        self.show_command_feedback(f"Erro ao abrir {url[:30]}", "#f38ba8")
        return False

    def tentar_app_ou_site(self, text):
        text = re.sub(r"^(quero |pode |você |voce |por favor |pfv |me )", "", text).strip()
        if text and self._fala_valida(text):
            self.abrir_alvo(text)
        elif text:
            self._log_historico(f"  · ignorado: \"{text}\"", "detalhe")
            self.conversar("Nao entendi o comando. Pode repetir?")
        else:
            self.conversar("Nao entendi o comando. Pode repetir?")

    def abrir_alvo(self, target):
        target_lower = target.lower().strip()

        if len(target_lower) < 2:
            self.conversar(f"Nao entendi '{target}'. Pode repetir?")
            return

        if target_lower in SITES:
            url = SITES[target_lower]
            self._abrir_url(url)
            self._log_comando(f"Site: {target_lower}")
            self.conversar(f"Abrindo {target_lower}! Mais alguma coisa?")
            return

        if target_lower in APPS:
            self.abrir_app(target_lower)
            return

        if "." in target_lower and " " not in target_lower:
            if not target_lower.startswith("http"):
                target_lower = "https://" + target_lower
            self._abrir_url(target_lower)
            self._log_comando(f"URL: {target_lower}")
            self.conversar(f"Abrindo pagina! Mais alguma coisa?")
            return

        if len(target_lower.split()) > 2:
            self._log_historico(f"  · nao entendi: \"{target}\"", "detalhe")
            self.conversar(f"Nao entendi '{target}'. Pode repetir?")
            return

        if self._tentar_app(target_lower):
            self._log_comando(f"App: {target_lower}")
            self.conversar(f"Abrindo {target_lower}! Mais alguma coisa?")
            return

        self._log_historico(f"  · nao entendi: \"{target}\"", "detalhe")
        self.conversar(f"Nao entendi '{target}'. Pode repetir?")

    def _tentar_app(self, target):
        try:
            os.startfile(target)
            self._log_comando(f"App: {target}")
            self.show_command_feedback(f"Abrindo {target}...", "#a6e3a1")
            return True
        except Exception:
            pass
        return False

    def abrir_app(self, target):
        target_lower = target.lower().strip()

        if target_lower == "opencode":
            self.abrir_opencode()
            return

        if target_lower in APPS:
            app_cmd_or_none = APPS[target_lower]
            if app_cmd_or_none:
                try:
                    startupinfo = subprocess.STARTUPINFO()
                    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                    subprocess.Popen(app_cmd_or_none, shell=True, startupinfo=startupinfo,
                                   stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
                    self._log_comando(f"App: {target_lower}")
                    self.show_command_feedback(f"Abrindo {target_lower}...", "#a6e3a1")
                    return
                except Exception:
                    pass

        if self._tentar_app(target_lower):
            return

        self.conversar(f"Nao encontrei o aplicativo {target_lower}. Pode tentar outro?")

    def fechar_app(self, target):
        try:
            subprocess.Popen(f"taskkill /IM {target}.exe /F",
                           stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
            self.show_command_feedback(f"Fechando {target}...", "#a6e3a1")
        except Exception:
            try:
                subprocess.Popen(f"taskkill /f /fi \"WINDOWTITLE eq *{target}*\"",
                               stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
                self.show_command_feedback(f"Fechando {target}...", "#a6e3a1")
            except Exception:
                self.show_command_feedback(f"Nao foi possivel fechar {target}", "#f38ba8")

    def _log_historico(self, msg, tag=None):
        if tag:
            self.text_display.insert(tk.END, f"{msg}\n", tag)
        else:
            self.text_display.insert(tk.END, f"{msg}\n")
        self.text_display.see(tk.END)
        self.text_display.update_idletasks()
        self.root.update_idletasks()
        self.update_height()

    def _log_comando(self, msg):
        self._log_historico(f"  · {msg}", "detalhe")

    def abrir_opencode(self):
        opencode_dirs = [
            r"D:\Projetos IA",
            os.path.expanduser("~\\AppData\\Local\\Programs\\opencode"),
            os.path.expanduser("~\\AppData\\Local\\opencode"),
        ]
        for d in opencode_dirs:
            if os.path.isdir(d):
                os.chdir(d)
                try:
                    subprocess.Popen("opencode", shell=True)
                    self.show_command_feedback("Abrindo opencode...", "#a6e3a1")
                    self.text_display.insert(tk.END, "> App: opencode\n")
                    self.text_display.see(tk.END)
                    return
                except Exception:
                    pass
        try:
            subprocess.Popen("start wt -d D:\\Projetos IA", shell=True)
            self.show_command_feedback("Abrindo terminal em Projetos IA...", "#a6e3a1")
        except Exception:
            self.show_command_feedback("Opencode nao encontrado", "#f38ba8")

    def digitar_texto(self, text):
        try:
            import pyautogui
            pyautogui.write(text, interval=0.02)
            self.show_command_feedback(f"Digitando: {text[:30]}...", "#a6e3a1")
            self.text_display.insert(tk.END, f"> Digitar: {text}\n")
            self.text_display.see(tk.END)
        except ImportError:
            pyperclip.copy(text)
            self.show_command_feedback("Texto copiado (sem pyautogui)", "#f9e2af")

    def pesquisar_web(self, query):
        url = f"https://google.com/search?q={query.replace(' ', '+')}"
        self._abrir_url(url)
        self.show_command_feedback(f"Pesquisando: {query[:30]}...", "#a6e3a1")
        self._log_comando(f"Pesquisar: {query}")
        self.text_display.see(tk.END)

    def show_help(self):
        ajuda = (
            "COMANDOS:\n"
            "  'abra [site]' - abre site no navegador\n"
            "  'abra [app]' - abre aplicativo\n"
            "  'inicie [app]' - inicia programa\n"
            "  'digite [texto]' - digita texto\n"
            "  'pesquise [termo]' - pesquisa no Google\n"
            "  'feche [app]' - fecha aplicativo\n"
            "  'ajuda' - mostra esta ajuda\n\n"
            "SITES: vercel, supabase, github, google, youtube, gmail,\n"
            "       chatgpt, opencode, deepseek, npm, pip\n\n"
            "APPS: opencode, vscode, terminal, calculadora,\n"
            "      bloco de notas, chrome, edge, spotify\n\n"
            "Clique em 🤖 para alternar entre COMANDO e TEXTO\n"
            "Diga 'tchau' ou 'obrigado' para encerrar"
        )
        self.text_display.insert(tk.END, f"\n{ajuda}\n\n")
        self.text_display.see(tk.END)
        self.show_command_feedback("Ajuda exibida no historico", "#f9e2af")

    def clear_text(self):
        self.full_text = ""
        self.last_text = ""
        self.text_display.delete("1.0", tk.END)
        self.speech_label.config(text="")
        self.text_label.config(text="Limpo", fg="#6c7086")
        self.update_height()

    def on_close(self):
        self.is_listening = False
        self.save_config()
        self.root.destroy()


def main():
    root = tk.Tk()
    app = FloatingOverlay(root)
    try:
        import keyboard
        keyboard.add_hotkey("ctrl+shift+r", app.toggle_listening)
        keyboard.add_hotkey("ctrl+shift+t", app.toggle_click_through)
        keyboard.add_hotkey("ctrl+shift+m", app.toggle_mode)
    except Exception:
        pass
    root.mainloop()


if __name__ == "__main__":
    main()
