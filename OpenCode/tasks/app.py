import sqlite3
import os
import sys
import json
import subprocess
import socket
import threading
import ssl
from datetime import datetime, date
from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__, static_folder='.', static_url_path='')

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tasks.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                desc TEXT DEFAULT '',
                priority TEXT DEFAULT 'media',
                status TEXT DEFAULT 'pendente',
                created_at TEXT DEFAULT (datetime('now','localtime'))
            );
            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL,
                date TEXT DEFAULT (datetime('now','localtime')),
                action TEXT NOT NULL,
                from_status TEXT,
                to_status TEXT,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS subtasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                completed INTEGER DEFAULT 0,
                position INTEGER DEFAULT 0,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            );
        """)

init_db()

def migrate_db():
    with get_db() as conn:
        for col in ['position', 'due_date', 'tags']:
            try:
                conn.execute(f"ALTER TABLE tasks ADD COLUMN {col} TEXT DEFAULT ''")
            except sqlite3.OperationalError:
                pass
    with get_db() as conn:
        conn.execute("UPDATE tasks SET position=id WHERE position IS NULL OR position=''")
        conn.execute("UPDATE tasks SET due_date='' WHERE due_date IS NULL")
        conn.execute("UPDATE tasks SET tags='[]' WHERE tags IS NULL OR tags=''")

migrate_db()

def row_to_dict(row):
    return dict(row) if row else None

def task_with_relations(conn, task):
    t = dict(task)
    t['tags'] = json.loads(t.get('tags', '[]')) if isinstance(t.get('tags'), str) and t['tags'] else []
    t['subtasks'] = [dict(s) for s in conn.execute("SELECT * FROM subtasks WHERE task_id=? ORDER BY position ASC, id ASC", (t['id'],)).fetchall()]
    h = conn.execute("SELECT * FROM history WHERE task_id=? ORDER BY date ASC", (t['id'],)).fetchall()
    t['history'] = [dict(hh) for hh in h]
    return t

# --- API ---

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/tasks', methods=['GET'])
def list_tasks():
    status = request.args.get('status')
    priority = request.args.get('priority')
    tag = request.args.get('tag')
    with get_db() as conn:
        query = "SELECT * FROM tasks"
        params = []
        filters = []
        if status and status != 'todas':
            filters.append("status=?")
            params.append(status)
        if priority and priority != 'todas':
            filters.append("priority=?")
            params.append(priority)
        sql = query + (" WHERE " + " AND ".join(filters) if filters else "") + " ORDER BY CAST(position AS INTEGER) ASC"
        rows = conn.execute(sql, params).fetchall()
        tasks = []
        for r in rows:
            t = task_with_relations(conn, r)
            if tag and tag not in t['tags']:
                continue
            tasks.append(t)
    return jsonify(tasks)

@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.get_json()
    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': 'Titulo obrigatorio'}), 400
    desc = data.get('desc', '').strip()
    priority = data.get('priority', 'media')
    due_date = data.get('due_date', '')
    tags = json.dumps(data.get('tags', []))
    with get_db() as conn:
        max_pos = conn.execute("SELECT COALESCE(MAX(CAST(position AS INTEGER)), 0) FROM tasks").fetchone()[0]
        new_pos = max_pos + 1
        cur = conn.execute(
            "INSERT INTO tasks (title, desc, priority, due_date, position, tags) VALUES (?, ?, ?, ?, ?, ?)",
            (title, desc, priority, due_date, str(new_pos), tags)
        )
        task_id = cur.lastrowid
        now = datetime.now().strftime('%d/%m/%Y %H:%M')
        conn.execute(
            "INSERT INTO history (task_id, action, from_status, to_status) VALUES (?, ?, ?, ?)",
            (task_id, 'Tarefa criada', None, 'pendente')
        )
        task = conn.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
        result = task_with_relations(conn, task)
    return jsonify(result), 201

@app.route('/api/tasks/<int:task_id>', methods=['GET'])
def get_task(task_id):
    with get_db() as conn:
        task = conn.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
        if not task:
            return jsonify({'error': 'Tarefa nao encontrada'}), 404
        result = task_with_relations(conn, task)
    return jsonify(result)

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    with get_db() as conn:
        task = conn.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
        if not task:
            return jsonify({'error': 'Tarefa nao encontrada'}), 404
        data = request.get_json()
        new_title = data.get('title', task['title']).strip()
        new_desc = data.get('desc', task['desc']).strip()
        new_priority = data.get('priority', task['priority'])
        new_status = data.get('status', task['status'])
        new_due_date = data.get('due_date', task['due_date'] or '')
        old_tags = json.loads(task['tags']) if isinstance(task['tags'], str) and task['tags'] else []
        new_tags = data.get('tags', old_tags)
        valid_status = {'pendente', 'andamento', 'concluida'}
        if new_status not in valid_status:
            new_status = task['status']
        if not new_title:
            return jsonify({'error': 'Titulo obrigatorio'}), 400

        changes = []
        if new_title != task['title']:
            changes.append(f'titulo alterado para "{new_title}"')
        if new_desc != (task['desc'] or ''):
            changes.append('descricao atualizada')
        prio_labels = {'baixa': 'Baixa', 'media': 'Media', 'alta': 'Alta', 'critica': 'Critica'}
        if new_priority != task['priority']:
            changes.append(f'prioridade alterada para "{prio_labels.get(new_priority, new_priority)}"')
        status_labels = {'pendente': 'Pendente', 'andamento': 'Em Andamento', 'concluida': 'Concluida'}
        if new_status != task['status']:
            changes.append(f'status alterado para "{status_labels[new_status]}"')

        conn.execute(
            "UPDATE tasks SET title=?, desc=?, priority=?, status=?, due_date=?, tags=? WHERE id=?",
            (new_title, new_desc, new_priority, new_status, new_due_date, json.dumps(new_tags), task_id)
        )

        if changes:
            conn.execute(
                "INSERT INTO history (task_id, action, from_status, to_status) VALUES (?, ?, ?, ?)",
                (task_id, f'Editado: {"; ".join(changes)}', task['status'], new_status)
            )

        updated = conn.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
        result = task_with_relations(conn, updated)
    return jsonify(result)

@app.route('/api/tasks/<int:task_id>/status', methods=['PUT'])
def update_status(task_id):
    with get_db() as conn:
        task = conn.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
        if not task:
            return jsonify({'error': 'Tarefa nao encontrada'}), 404
        data = request.get_json()
        new_status = data.get('status')
        valid_status = {'pendente', 'andamento', 'concluida'}
        if new_status not in valid_status:
            return jsonify({'error': 'Status invalido'}), 400

        labels = {'pendente': 'Pendente', 'andamento': 'Em Andamento', 'concluida': 'Concluida'}
        conn.execute("UPDATE tasks SET status=? WHERE id=?", (new_status, task_id))
        conn.execute(
            "INSERT INTO history (task_id, action, from_status, to_status) VALUES (?, ?, ?, ?)",
            (task_id, f'Status alterado para "{labels[new_status]}"', task['status'], new_status)
        )

        updated = conn.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
        result = task_with_relations(conn, updated)
    return jsonify(result)

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    with get_db() as conn:
        task = conn.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
        if not task:
            return jsonify({'error': 'Tarefa nao encontrada'}), 404
        conn.execute("DELETE FROM tasks WHERE id=?", (task_id,))
    return jsonify({'message': 'Tarefa excluida'})

@app.route('/api/tasks/reorder', methods=['PUT'])
def reorder_tasks():
    data = request.get_json()
    order = data.get('ordered_ids') or data.get('order', [])
    with get_db() as conn:
        for pos, task_id in enumerate(order):
            conn.execute("UPDATE tasks SET position=? WHERE id=?", (str(pos), task_id))
    return jsonify({'message': 'Ordem atualizada'})

@app.route('/api/tasks/<int:task_id>/subtasks', methods=['POST'])
def create_subtask(task_id):
    data = request.get_json()
    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': 'Titulo obrigatorio'}), 400
    with get_db() as conn:
        task = conn.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
        if not task:
            return jsonify({'error': 'Tarefa nao encontrada'}), 404
        max_pos = conn.execute("SELECT COALESCE(MAX(position), 0) FROM subtasks WHERE task_id=?", (task_id,)).fetchone()[0]
        cur = conn.execute(
            "INSERT INTO subtasks (task_id, title, position) VALUES (?, ?, ?)",
            (task_id, title, max_pos + 1)
        )
        st = conn.execute("SELECT * FROM subtasks WHERE id=?", (cur.lastrowid,)).fetchone()
    return jsonify(dict(st)), 201

@app.route('/api/tasks/<int:task_id>/subtasks/<int:subtask_id>', methods=['PUT'])
def update_subtask(task_id, subtask_id):
    data = request.get_json()
    with get_db() as conn:
        st = conn.execute("SELECT * FROM subtasks WHERE id=? AND task_id=?", (subtask_id, task_id)).fetchone()
        if not st:
            return jsonify({'error': 'Subtarefa nao encontrada'}), 404
        new_title = data.get('title', st['title']).strip()
        new_completed = data.get('completed', st['completed'])
        if not new_title:
            return jsonify({'error': 'Titulo obrigatorio'}), 400
        conn.execute(
            "UPDATE subtasks SET title=?, completed=? WHERE id=?",
            (new_title, 1 if new_completed else 0, subtask_id)
        )
        updated = conn.execute("SELECT * FROM subtasks WHERE id=?", (subtask_id,)).fetchone()
    return jsonify(dict(updated))

@app.route('/api/tasks/<int:task_id>/subtasks/<int:subtask_id>', methods=['DELETE'])
def delete_subtask(task_id, subtask_id):
    with get_db() as conn:
        st = conn.execute("SELECT * FROM subtasks WHERE id=? AND task_id=?", (subtask_id, task_id)).fetchone()
        if not st:
            return jsonify({'error': 'Subtarefa nao encontrada'}), 404
        conn.execute("DELETE FROM subtasks WHERE id=?", (subtask_id,))
    return jsonify({'message': 'Subtarefa excluida'})

@app.route('/api/export', methods=['GET'])
def export_tasks():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM tasks ORDER BY CAST(position AS INTEGER) ASC").fetchall()
        lines = []
        div = '=' * 72
        lines.append(div)
        lines.append('  TASKFLOW - RELATORIO DE TAREFAS')
        now = datetime.now().strftime('%d/%m/%Y %H:%M')
        lines.append(f'  Gerado em: {now}')
        lines.append(f'  Total de tarefas: {len(rows)}')
        lines.append(div)
        lines.append('')
        status_map = {'pendente': 'Pendente', 'andamento': 'Em Andamento', 'concluida': 'Concluida'}
        for i, r in enumerate(rows, 1):
            t = dict(r)
            lines.append(f'[{i}] {t["title"]}')
            lines.append(f'    ID: #{t["id"]}')
            lines.append(f'    Status: {status_map.get(t["status"], t["status"])}')
            lines.append(f'    Prioridade: {t["priority"].capitalize()}')
            lines.append(f'    Criado em: {t["created_at"]}')
            if t['desc']:
                lines.append(f'    Descricao: {t["desc"]}')
            tags = json.loads(t['tags']) if isinstance(t['tags'], str) and t['tags'] else []
            if tags:
                lines.append(f'    Tags: {", ".join(tags)}')
            h = conn.execute("SELECT * FROM history WHERE task_id=? ORDER BY date ASC", (t['id'],)).fetchall()
            lines.append(f'    Historico ({len(h)} registro(s)):')
            for hh in h:
                lines.append(f'      - {hh["action"]} ({hh["date"]})')
            lines.append('')
            lines.append(div)
            lines.append('')
        content = '\r\n'.join(lines)
    return content, 200, {'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': f'attachment; filename=taskflow-tarefas-{datetime.now().strftime("%Y-%m-%d")}.txt'}

def get_lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.1)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return None

def run_http():
    """Run HTTP server on port 5001."""
    app.run(host='0.0.0.0', port=5001, debug=False, use_reloader=False)

def run_https(cert_file, key_file):
    """Run HTTPS server on port 5000."""
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False, ssl_context=(cert_file, key_file))

if __name__ == '__main__':
    BASE = os.path.dirname(os.path.abspath(__file__))
    cert_file = os.path.join(BASE, 'cert.pem')
    key_file = os.path.join(BASE, 'key.pem')
    gen_script = os.path.join(BASE, 'gen_cert.py')

    lan_ip = get_lan_ip()
    if not (os.path.exists(cert_file) and os.path.exists(key_file)):
        print('')
        print('=' * 60)
        print('  Certificado SSL nao encontrado.')
        print('  Vou gerar um certificado auto-assinado.')
        manual_ip = input(f'  IP detectado: {lan_ip or "N/A"} - Enter para usar este, ou digite outro: ').strip()
        final_ip = manual_ip or lan_ip or None
        print('=' * 60)
        print('')
        cmd = [sys.executable, gen_script]
        if final_ip:
            cmd.append(final_ip)
        subprocess.run(cmd, cwd=BASE, check=True)
        print('')

    display = lan_ip or 'SEU_IP'
    print('')
    print('=' * 60)
    print('  TaskFlow rodando!')
    print('')
    print('  >>> HTTP  (acesso normal):')
    print(f'      http://{display}:5001')
    print('      (sem aviso de certificado)')
    print('')
    print('  >>> HTTPS (para instalar o PWA):')
    print(f'      https://{display}:5000')
    print('      Aceite o aviso -> clique em "Avançado" e "Prosseguir"')
    print('')
    print('  No celular, use a porta HTTP (5001) para uso diario,')
    print('  e HTTPS (5000) apenas para instalar o app.')
    print('=' * 60)
    print('')

    # Start HTTPS in background thread
    t = threading.Thread(target=run_https, args=(cert_file, key_file), daemon=True)
    t.start()

    # Run HTTP in main thread
    run_http()
