import { extension_settings } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';

(() => {
    'use strict';

    if (document.getElementById('oocnb-toggle')) return;

    const KEY = 'ooc_notebook_v1';

    function makeId() {
        return globalThis.crypto?.randomUUID?.()
            ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    function makeNote(title = 'Новая заметка', text = '') {
        return { id: makeId(), title, text };
    }

    if (!extension_settings[KEY]) {
        extension_settings[KEY] = {
            notes: [makeNote('Мои OOC')],
        };
        saveSettingsDebounced();
    }

    const data = extension_settings[KEY];

    // При неожиданном формате не перезаписываем заметки.
    if (!Array.isArray(data.notes)) {
        console.error('OOC Notebook: неверный формат сохранённых данных.');
        return;
    }

    if (!data.notes.length) {
        data.notes.push(makeNote('Мои OOC'));
        saveSettingsDebounced();
    }

    let selectedId = data.notes[0].id;

    const toggle = document.createElement('button');
    toggle.id = 'oocnb-toggle';
    toggle.type = 'button';
    toggle.textContent = '📝 Мои OOC';
    toggle.setAttribute('aria-controls', 'oocnb-panel');
    toggle.setAttribute('aria-expanded', 'false');

    const panel = document.createElement('section');
    panel.id = 'oocnb-panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Блокнот OOC');

    // Только статический интерфейс.
    // Содержимое заметок никогда не вставляется как HTML.
    panel.innerHTML = `
        <div class="oocnb-header">
            <strong>📝 Мои OOC</strong>
            <button type="button" data-action="close"
                aria-label="Закрыть блокнот">✕</button>
        </div>

        <div class="oocnb-body">
            <div class="oocnb-hint">
                Личный блокнот. Сам ничего не передаёт модели.
            </div>

            <div class="oocnb-row">
                <select class="oocnb-list"
                    aria-label="Выбрать заметку"></select>
                <button type="button" data-action="new">＋ Новая</button>
            </div>

            <input class="oocnb-title" type="text"
                placeholder="Название заметки"
                aria-label="Название заметки">

            <textarea class="oocnb-text"
                placeholder="Твой OOC или любая заметка…"
                aria-label="Текст заметки"></textarea>

            <div class="oocnb-row oocnb-wrap">
                <button type="button" data-action="copy">
                    Копировать
                </button>
                <button type="button" data-action="insert">
                    Вставить в поле ввода
                </button>
            </div>

            <div class="oocnb-row oocnb-wrap">
                <button type="button" data-action="export">
                    Экспорт
                </button>
                <button type="button" data-action="import">
                    Импорт
                </button>
                <button type="button" data-action="delete">
                    Удалить заметку
                </button>
            </div>

            <div class="oocnb-hint">
                Автосохранение в настройках ST · общие для всех чатов
            </div>

            <input class="oocnb-file" type="file"
                accept=".json,application/json" hidden>
        </div>
    `;

    // Старую плавающую кнопку больше не показываем.
toggle.style.setProperty('display', 'none', 'important');
document.body.append(toggle, panel);

// Пункт в меню волшебной палочки.
const wandItem = document.createElement('div');
wandItem.id = 'oocnb-wand-item';
wandItem.className = 'list-group-item flex-container flexGap5';
wandItem.setAttribute('role', 'button');
wandItem.tabIndex = 0;

wandItem.innerHTML = `
    <span class="fa-solid fa-book"></span>
    <span>Мои OOC — блокнот</span>
`;

wandItem.addEventListener('click', () => {
    setOpen(panel.hidden);
});

wandItem.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        wandItem.click();
    }
});

function mountNotebookMenu() {
    const menu = document.getElementById('extensionsMenu');

    if (!menu) {
        setTimeout(mountNotebookMenu, 500);
        return;
    }

    if (!menu.contains(wandItem)) {
        menu.append(wandItem);
    }
}

mountNotebookMenu();

    const list = panel.querySelector('.oocnb-list');
    const title = panel.querySelector('.oocnb-title');
    const text = panel.querySelector('.oocnb-text');
    const fileInput = panel.querySelector('.oocnb-file');

    function currentNote() {
        return data.notes.find(note => note.id === selectedId);
    }

    function save() {
        saveSettingsDebounced();
    }

    function setOpen(open) {
        panel.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
    }

    function renderList() {
        list.replaceChildren();

        for (const note of data.notes) {
            const option = document.createElement('option');
            option.value = note.id;
            option.textContent = note.title.trim() || 'Без названия';
            list.append(option);
        }

        list.value = selectedId;
    }

    function showNote() {
        const note = currentNote();
        if (!note) return;

        title.value = note.title;
        text.value = note.text;
        renderList();
    }

    function onAction(name, callback) {
        panel.querySelector(`[data-action="${name}"]`)
            .addEventListener('click', callback);
    }

    toggle.addEventListener('click', () => {
        setOpen(panel.hidden);
    });

    onAction('close', () => setOpen(false));

    panel.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            setOpen(false);
            toggle.focus();
            event.stopPropagation();
        }
    });

    list.addEventListener('change', () => {
        selectedId = list.value;
        showNote();
    });

    title.addEventListener('input', () => {
        const note = currentNote();
        if (!note) return;

        note.title = title.value;

        const option = list.options[list.selectedIndex];
        if (option) {
            option.textContent = note.title.trim() || 'Без названия';
        }

        save();
    });

    text.addEventListener('input', () => {
        const note = currentNote();
        if (!note) return;

        note.text = text.value;
        save();
    });

    onAction('new', () => {
        const note = makeNote();
        data.notes.push(note);
        selectedId = note.id;
        save();
        showNote();
        title.focus();
        title.select();
    });

    onAction('delete', () => {
        const note = currentNote();
        if (!note) return;

        const name = note.title.trim() || 'Без названия';

        if (!window.confirm(`Удалить заметку «${name}»?`)) return;

        const index = data.notes.findIndex(item => item.id === selectedId);
        data.notes.splice(index, 1);

        if (!data.notes.length) {
            data.notes.push(makeNote());
        }

        selectedId = data.notes[Math.min(index, data.notes.length - 1)].id;
        save();
        showNote();
    });

    onAction('copy', async () => {
        const note = currentNote();
        if (!note) return;

        try {
            await navigator.clipboard.writeText(note.text);

            const button = panel.querySelector('[data-action="copy"]');
            button.textContent = 'Скопировано ✓';

            setTimeout(() => {
                button.textContent = 'Копировать';
            }, 1500);
        } catch {
            text.focus();
            text.select();

            window.alert(
                'Автокопирование недоступно. ' +
                'Текст выделен — скопируй его вручную.',
            );
        }
    });

    onAction('insert', () => {
        const note = currentNote();
        if (!note?.text) return;

        const input = document.getElementById('send_textarea');

        if (!input || input.disabled || input.readOnly) {
            window.alert('Поле ввода ST сейчас недоступно.');
            return;
        }

        // Добавляем к черновику, а не заменяем его.
        input.value += (input.value ? '\n\n' : '') + note.text;
        input.dispatchEvent(new Event('input', { bubbles: true }));

        setOpen(false);
        input.focus();

        // Отправку сообщения НЕ запускаем.
    });

    onAction('export', () => {
        const backup = {
            version: 1,
            notes: data.notes.map(note => ({
                title: note.title,
                text: note.text,
            })),
        };

        const blob = new Blob(
            [JSON.stringify(backup, null, 2)],
            { type: 'application/json;charset=utf-8' },
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download =
            `ooc-notebook-${new Date().toISOString().slice(0, 10)}.json`;

        document.body.append(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    onAction('import', () => {
        fileInput.value = '';
        fileInput.click();
    });

    fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file) return;

        try {
            if (file.size > 5 * 1024 * 1024) {
                throw new Error('Файл больше 5 МБ.');
            }

            const backup = JSON.parse(await file.text());

            if (
                !Array.isArray(backup.notes) ||
                !backup.notes.length ||
                backup.notes.length > 1000 ||
                !backup.notes.every(note =>
                    note &&
                    typeof note.title === 'string' &&
                    typeof note.text === 'string'
                )
            ) {
                throw new Error('Не подходит формат файла.');
            }

            if (!window.confirm(
                `Добавить заметки из файла: ${backup.notes.length}?\n` +
                'Текущие заметки останутся. Повторный импорт создаст копии.',
            )) return;

            const imported = backup.notes.map(note =>
                makeNote(note.title, note.text)
            );

            data.notes.push(...imported);
            selectedId = imported[0].id;

            save();
            showNote();
        } catch (error) {
            window.alert(`Не удалось импортировать: ${error.message}`);
        }
    });

    showNote();
})();
