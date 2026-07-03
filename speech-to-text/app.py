import tkinter as tk
from tkinter import ttk, scrolledtext
import speech_recognition as sr
import threading
import pyperclip
import json
import os
from pathlib import Path


CONFIG_FILE = Path(__file__).parent / "config.json"

DEFAULT_CONFIG = {
    "always_on_top": True,
    "energy_threshold": 3000,
    "pause_threshold": 0.8,
    "language": "pt-BR",
    "theme": "dark",
    "engine": "google"
}


class SpeechToTextApp:
    def __init__(self, root):
        self.root = root
        self.config = self.load_config()
        self.recognizer = sr.Recognizer()
        self.recognizer.energy_threshold = self.config.get("energy_threshold", 3000)
        self.recognizer.pause_threshold = self.config.get("pause_threshold", 0.8)
        self.is_listening = False
        self.listener_thread = None
        self.source = None
        self.audio_data = []

        self.setup_ui()
        self.apply_theme()
        self.root.attributes("-topmost", self.config.get("always_on_top", True))

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

    def setup_ui(self):
        self.root.title("Fala para Texto")
        self.root.geometry("500x400")
        self.root.minsize(400, 300)

        style = ttk.Style()

        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)

        top_frame = ttk.Frame(main_frame)
        top_frame.pack(fill=tk.X, pady=(0, 10))

        self.record_btn = ttk.Button(
            top_frame,
            text="🎤 Iniciar Gravação",
            command=self.toggle_listening,
            width=20
        )
        self.record_btn.pack(side=tk.LEFT, padx=(0, 5))

        self.status_label = ttk.Label(
            top_frame,
            text="Pronto",
            foreground="gray"
        )
        self.status_label.pack(side=tk.LEFT, padx=(5, 0))

        btn_frame = ttk.Frame(main_frame)
        btn_frame.pack(fill=tk.X, pady=(0, 10))

        self.copy_btn = ttk.Button(
            btn_frame,
            text="📋 Copiar Texto",
            command=self.copy_text,
            width=15
        )
        self.copy_btn.pack(side=tk.LEFT, padx=(0, 5))

        self.clear_btn = ttk.Button(
            btn_frame,
            text="🗑️ Limpar",
            command=self.clear_text,
            width=12
        )
        self.clear_btn.pack(side=tk.LEFT, padx=(5, 0))

        self.text_area = scrolledtext.ScrolledText(
            main_frame,
            wrap=tk.WORD,
            font=("Segoe UI", 12),
            relief=tk.FLAT,
            borderwidth=1
        )
        self.text_area.pack(fill=tk.BOTH, expand=True)

        bottom_frame = ttk.Frame(main_frame)
        bottom_frame.pack(fill=tk.X, pady=(10, 0))

        self.shortcut_label = ttk.Label(
            bottom_frame,
            text="Atalho: Ctrl+Shift+R (iniciar/parar)",
            foreground="gray",
            font=("Segoe UI", 9)
        )
        self.shortcut_label.pack(side=tk.LEFT)

        self.pin_btn = ttk.Button(
            bottom_frame,
            text="📌 Fixar",
            command=self.toggle_pin,
            width=8
        )
        self.pin_btn.pack(side=tk.RIGHT, padx=(5, 0))

        self.settings_btn = ttk.Button(
            bottom_frame,
            text="⚙️",
            command=self.open_settings,
            width=3
        )
        self.settings_btn.pack(side=tk.RIGHT)

        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

    def apply_theme(self):
        theme = self.config.get("theme", "dark")
        bg = "#1e1e2e" if theme == "dark" else "#ffffff"
        fg = "#cdd6f4" if theme == "dark" else "#000000"
        text_bg = "#313244" if theme == "dark" else "#f5f5f5"
        text_fg = "#cdd6f4" if theme == "dark" else "#000000"
        select_bg = "#585b70" if theme == "dark" else "#0078d4"

        self.root.configure(bg=bg)
        self.text_area.configure(
            bg=text_bg,
            fg=text_fg,
            insertbackground=fg,
            selectbackground=select_bg
        )

    def toggle_pin(self):
        current = self.root.attributes("-topmost")
        self.root.attributes("-topmost", not current)
        self.config["always_on_top"] = not current
        self.save_config()
        self.pin_btn.config(text="📌 Fixar" if not current else "📍 Fixado")

    def open_settings(self):
        settings_win = tk.Toplevel(self.root)
        settings_win.title("Configurações")
        settings_win.geometry("400x300")
        settings_win.transient(self.root)
        settings_win.grab_set()

        frame = ttk.Frame(settings_win, padding="15")
        frame.pack(fill=tk.BOTH, expand=True)

        ttk.Label(frame, text="Idioma:", font=("Segoe UI", 10)).pack(anchor=tk.W, pady=(0, 5))
        lang_var = tk.StringVar(value=self.config.get("language", "pt-BR"))
        lang_combo = ttk.Combobox(
            frame,
            textvariable=lang_var,
            values=["pt-BR", "en-US", "es-ES", "fr-FR", "de-DE", "it-IT", "ja-JP"],
            state="readonly",
            width=20
        )
        lang_combo.pack(anchor=tk.W, pady=(0, 15))

        ttk.Label(frame, text="Motor de Reconhecimento:", font=("Segoe UI", 10)).pack(anchor=tk.W, pady=(0, 5))
        engine_var = tk.StringVar(value=self.config.get("engine", "google"))
        engine_combo = ttk.Combobox(
            frame,
            textvariable=engine_var,
            values=["google", "whisper"],
            state="readonly",
            width=20
        )
        engine_combo.pack(anchor=tk.W, pady=(0, 15))

        ttk.Label(frame, text="Tema:", font=("Segoe UI", 10)).pack(anchor=tk.W, pady=(0, 5))
        theme_var = tk.StringVar(value=self.config.get("theme", "dark"))
        theme_combo = ttk.Combobox(
            frame,
            textvariable=theme_var,
            values=["dark", "light"],
            state="readonly",
            width=20
        )
        theme_combo.pack(anchor=tk.W, pady=(0, 15))

        def save_settings():
            self.config["language"] = lang_var.get()
            self.config["engine"] = engine_var.get()
            self.config["theme"] = theme_var.get()
            self.save_config()
            self.apply_theme()
            settings_win.destroy()

        ttk.Button(frame, text="Salvar", command=save_settings).pack(pady=(10, 0))

    def toggle_listening(self):
        if self.is_listening:
            self.stop_listening()
        else:
            self.start_listening()

    def start_listening(self):
        self.is_listening = True
        self.record_btn.config(text="⏹️ Parar Gravação")
        self.status_label.config(text="Ouvindo...", foreground="#a6e3a1")
        self.listener_thread = threading.Thread(target=self.listen_loop, daemon=True)
        self.listener_thread.start()

    def stop_listening(self):
        self.is_listening = False
        self.record_btn.config(text="🎤 Iniciar Gravação")
        self.status_label.config(text="Parado", foreground="#f38ba8")

    def listen_loop(self):
        try:
            with sr.Microphone() as source:
                self.recognizer.adjust_for_ambient_noise(source, duration=0.5)
                while self.is_listening:
                    try:
                        audio = self.recognizer.listen(source, timeout=1, phrase_time_limit=10)
                        self.root.after(0, lambda: self.status_label.config(
                            text="Processando...", foreground="#f9e2af"
                        ))
                        threading.Thread(target=self.transcribe_audio, args=(audio,), daemon=True).start()
                    except sr.WaitTimeoutError:
                        continue
                    except Exception as e:
                        self.root.after(0, lambda: self.status_label.config(
                            text=f"Erro: {str(e)[:30]}", foreground="#f38ba8"
                        ))
        except Exception as e:
            self.root.after(0, lambda: self.status_label.config(
                text=f"Erro microfone: {str(e)[:30]}", foreground="#f38ba8"
            ))
            self.root.after(0, self.stop_listening)

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
                self.root.after(0, lambda t=text: self.append_text(t))
                self.root.after(0, lambda: self.status_label.config(
                    text="Fala detectada!", foreground="#a6e3a1"
                ))
        except sr.UnknownValueError:
            self.root.after(0, lambda: self.status_label.config(
                text="Não entendi", foreground="#f9e2af"
            ))
        except sr.RequestError as e:
            self.root.after(0, lambda: self.status_label.config(
                text="Sem conexão", foreground="#f38ba8"
            ))
        except Exception as e:
            self.root.after(0, lambda: self.status_label.config(
                text=f"Erro: {str(e)[:20]}", foreground="#f38ba8"
            ))

    def append_text(self, text):
        current = self.text_area.get("1.0", tk.END).strip()
        if current:
            self.text_area.insert(tk.END, f" {text}")
        else:
            self.text_area.insert(tk.END, text)
        self.text_area.see(tk.END)
        self.copy_text()

    def copy_text(self):
        text = self.text_area.get("1.0", tk.END).strip()
        if text:
            pyperclip.copy(text)
            self.status_label.config(text="Copiado!", foreground="#a6e3a1")
            self.root.after(2000, lambda: self.status_label.config(
                text="Ouvindo..." if self.is_listening else "Pronto",
                foreground="#a6e3a1" if self.is_listening else "gray"
            ))

    def clear_text(self):
        self.text_area.delete("1.0", tk.END)

    def on_close(self):
        self.is_listening = False
        self.save_config()
        self.root.destroy()


def main():
    root = tk.Tk()
    app = SpeechToTextApp(root)

    try:
        import keyboard
        keyboard.add_hotkey("ctrl+shift+r", app.toggle_listening)
    except ImportError:
        pass
    except Exception:
        pass

    root.mainloop()


if __name__ == "__main__":
    main()
