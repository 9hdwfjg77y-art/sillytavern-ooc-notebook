import { extension_settings } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';

(() => {
    if (window.__stOocNotebookCardsLoaded) return;
    window.__stOocNotebookCardsLoaded = true;

    const KEY = 'ooc_notebook_v1';

    function makeId() {
        return globalThis.crypto?.randomUUID?.()
            ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    function makeNote(title = 'Новая заметка', text = '') {
        return { id: makeId(), title, text };
    }

    function init() {
        if (document.getElementById('oocnb-root')) return;

        let needsSave = false;

        if (extension_settings[KEY] === undefined) {
            extension_settings[KEY] = {
                notes: [makeNote('Мои OOC')]
            };
            needsSave = true;
        }

        const data = extension_settings[KEY];

        const valid =
            data &&
            Array.isArray(data.notes) &&
            data.notes.every(note =>
                note &&
                typeof note.id === 'string' &&
                typeof note.title === 'string' &&
                typeof note.text === 'string'
            );

        const uniqueIds = valid &&
            new Set(data.notes.map(note => note.id)).size === data.notes.length;

        if (!valid || !uniqueIds) {
            console.error('OOC Notebook: неверный формат сохранённых данных.');
            alert(
                'OOC-блокнот: не удалось прочитать сохранённые заметки. ' +
                'Они не были удалены или заменены.'
            );
            return;
        }

        if (!data.notes.length) {
            data.notes.push(makeNote('Мои OOC'));
            needsSave = true;
        }

        function save() {
            saveSettingsDebounced();
        }

        if (needsSave) save();

        const root = document.createElement('div');
        root.id = 'oocnb-root';
        root.hidden = true;

        root.innerHTML = `
            <section
                id="oocnb-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="oocnb-heading"
                tabindex="-1"
            >
                <header class="oocnb-header">
                    <div>
                        <h2 id="oocnb-heading">📝 OOC-блокнот</h2>
                        <div class="oocnb-subtitle">
                            Общие заметки для всех чатов
                        </div>
                    </div>
                    <button
                        type="button"
                        class="oocnb-button oocnb-close"
                        data-action="close"
                        aria-label="Закрыть блокнот"
                    >✕</button>
                </header>

                <div class="oocnb-toolbar">
                    <button
                        type="button"
                        class="oocnb-button oocnb-new"
                        data-action="new"
                    >＋ Новая заметка</button>
                    <button
                        type="button"
                        class="oocnb-button"
                        data-action="export"
                    >Экспорт</button>
                    <button
                        type="button"
                        class="oocnb-button"
                        data-action="import"
                    >Импорт</button>
                </div>

                <div class="oocnb-search-row">
                    <input
                        type="search"
                        class="oocnb-search"
                        placeholder="Поиск по заголовкам и тексту…"
                        aria-label="Поиск заметок"
                        autocomplete="off"
                    >
                    <span class="oocnb-count"></span>
                </div>

                <div class="oocnb-cards"></div>

                <footer class="oocnb-footer">
                    <div class="oocnb-status" role="status"></div>
                    <div>
                        Заметки сохраняются при редактировании.
                        «Вставить в чат» не отправляет сообщение.
                    </div>
                </footer>

                <input
                    type="file"
                    class="oocnb-file"
                    accept=".json,application/json"
                    hidden
                >
            </section>
        `;

        document.body.append(root);

        const panel = root.querySelector('#oocnb-panel');
        const search = root.querySelector('.oocnb-search');
        const cards = root.querySelector('.oocnb-cards');
        const count = root.querySelector('.oocnb-count');
        const status = root.querySelector('.oocnb-status');
        const fileInput = root.querySelector('.oocnb-file');

        let previousFocus = null;
        let menuEntry = null;

        function titleOf(note) {
            return note.title.trim() || 'Без названия';
        }

        function say(text = '') {
            status.textContent = text;
        }

        function openNotebook() {
            previousFocus = document.activeElement;
            root.hidden = false;
            menuEntry?.setAttribute('aria-expanded', 'true');
            say();
            render();
            search.focus({ preventScroll: true });
        }

        function closeNotebook() {
            root.hidden = true;
            menuEntry?.setAttribute('aria-expanded', 'false');

            if (
                previousFocus instanceof HTMLElement &&
                previousFocus.isConnected &&
                previousFocus.getClientRects().length
            ) {
                previousFocus.focus({ preventScroll: true });
            } else {
                document.getElementById('send_textarea')
                    ?.focus({ preventScroll: true });
            }
        }

        function button(label, action) {
            const element = document.createElement('button');
            element.type = 'button';
            element.className = 'oocnb-button';
            element.textContent = label;
            element.addEventListener('click', action);
            return element;
        }

        function buildCard(note) {
            const card = document.createElement('article');
            card.className = 'oocnb-card';

            const heading = document.createElement('h3');
            heading.className = 'oocnb-card-title';
            heading.textContent = titleOf(note);

            const preview = document.createElement('div');
            preview.className = 'oocnb-preview';
            preview.textContent = note.text || 'Пустая заметка';
            preview.classList.toggle('oocnb-empty-text', !note.text);

            const editor = document.createElement('div');
            editor.className = 'oocnb-editor';
            editor.hidden = true;

            const titleLabel = document.createElement('label');
            titleLabel.className = 'oocnb-field';
            titleLabel.append(document.createTextNode('Заголовок'));

            const titleInput = document.createElement('input');
            titleInput.type = 'text';
            titleInput.className = 'oocnb-title';
            titleInput.placeholder = 'Название заметки';
            titleInput.value = note.title;
            titleLabel.append(titleInput);

            const textLabel = document.createElement('label');
            textLabel.className = 'oocnb-field';
            textLabel.append(document.createTextNode('Текст OOC'));

            const textInput = document.createElement('textarea');
            textInput.className = 'oocnb-text';
            textInput.placeholder = 'Напиши или вставь OOC…';
            textInput.value = note.text;
            textInput.rows = 7;
            textLabel.append(textInput);

            editor.append(titleLabel, textLabel);

            titleInput.addEventListener('input', () => {
                note.title = titleInput.value;
                heading.textContent = titleOf(note);
                save();
            });

            textInput.addEventListener('input', () => {
                note.text = textInput.value;
                preview.textContent = note.text || 'Пустая заметка';
                preview.classList.toggle('oocnb-empty-text', !note.text);
                save();
            });

            const actions = document.createElement('div');
            actions.className = 'oocnb-card-actions';

            function setEditing(editing, focusTitle = false) {
                editor.hidden = !editing;
                preview.hidden = editing;
                editButton.textContent = editing
                    ? 'Готово'
                    : 'Редактировать';

                if (editing) {
                    const field = focusTitle ? titleInput : textInput;
                    field.focus({ preventScroll: true });
                    if (focusTitle) titleInput.select();
                }
            }

            const editButton = button('Редактировать', () => {
                setEditing(editor.hidden);
            });

            const copyButton = button('Копировать', async () => {
                if (!note.text) {
                    say('В этой заметке пока нет текста.');
                    return;
                }

                try {
                    await navigator.clipboard.writeText(note.text);
                    say(`Скопировано: «${titleOf(note)}».`);
                } catch {
                    setEditing(true);
                    textInput.select();
                    say(
                        'Автокопирование недоступно. ' +
                        'Текст выделен — скопируй его вручную.'
                    );
                }
            });

            const insertButton = button('Вставить в чат', () => {
                if (!note.text) {
                    say('В этой заметке пока нет текста.');
                    return;
                }

                const input = document.getElementById('send_textarea');

                if (!input || input.disabled || input.readOnly) {
                    say('Поле ввода ST сейчас недоступно.');
                    return;
                }

                input.value += (input.value ? '\n\n' : '') + note.text;
                input.dispatchEvent(new Event('input', { bubbles: true }));

                closeNotebook();
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
            });

            const deleteButton = button('Удалить', () => {
                if (!confirm(`Удалить заметку «${titleOf(note)}»?`)) return;

                const index = data.notes.findIndex(item => item.id === note.id);
                if (index < 0) return;

                data.notes.splice(index, 1);

                if (!data.notes.length) {
                    data.notes.push(makeNote('Мои OOC'));
                }

                save();
                render();
                say('Заметка удалена.');
            });
            deleteButton.classList.add('oocnb-delete');

            actions.append(
                editButton,
                copyButton,
                insertButton,
                deleteButton
            );

            card.append(heading, preview, editor, actions);

            return {
                element: card,
                edit: () => setEditing(true, true)
            };
        }

        function render(editId = null) {
            const query = search.value.trim().toLowerCase();

            const matches = data.notes.filter(note =>
                `${note.title}\n${note.text}`.toLowerCase().includes(query)
            );

            count.textContent = query
                ? `${matches.length} / ${data.notes.length}`
                : `${data.notes.length}`;

            const fragment = document.createDocumentFragment();
            let editNewCard = null;

            for (const note of matches) {
                const card = buildCard(note);
                fragment.append(card.element);

                if (note.id === editId) {
                    editNewCard = card.edit;
                }
            }

            if (!matches.length) {
                const empty = document.createElement('div');
                empty.className = 'oocnb-empty';
                empty.textContent = 'Ничего не найдено. Попробуй другой запрос.';
                fragment.append(empty);
            }

            cards.replaceChildren(fragment);

            if (editNewCard) {
                cards.scrollTop = 0;
                editNewCard();
            }
        }

        function exportNotes() {
            const backup = {
                version: 1,
                notes: data.notes.map(note => ({
                    title: note.title,
                    text: note.text
                }))
            };

            const blob = new Blob(
                [JSON.stringify(backup, null, 2)],
                { type: 'application/json;charset=utf-8' }
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
            say('Экспортированы все заметки, независимо от поиска.');
        }

        root.querySelector('[data-action="close"]')
            .addEventListener('click', closeNotebook);

        root.querySelector('[data-action="new"]')
            .addEventListener('click', () => {
                const note = makeNote();
                data.notes.unshift(note);
                search.value = '';
                save();
                render(note.id);
                say();
            });

        root.querySelector('[data-action="export"]')
            .addEventListener('click', exportNotes);

        root.querySelector('[data-action="import"]')
            .addEventListener('click', () => {
                fileInput.value = '';
                fileInput.click();
            });

        search.addEventListener('input', () => render());

        fileInput.addEventListener('change', async () => {
            const file = fileInput.files?.[0];
            if (!file) return;

            try {
                if (file.size > 5 * 1024 * 1024) {
                    throw new Error('Файл больше 5 МБ.');
                }

                const backup = JSON.parse(await file.text());

                if (
                    !backup ||
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

                const confirmed = confirm(
                    `Добавить заметки из файла: ${backup.notes.length}?\n\n` +
                    'Текущие заметки останутся. ' +
                    'Повторный импорт создаст копии.'
                );

                if (!confirmed) return;

                const imported = backup.notes.map(note =>
                    makeNote(note.title, note.text)
                );

                data.notes.push(...imported);
                search.value = '';
                save();
                render();
                say(`Добавлено заметок: ${imported.length}.`);
            } catch (error) {
                alert(
                    'Не удалось импортировать: ' +
                    (error instanceof Error ? error.message : String(error))
                );
            } finally {
                fileInput.value = '';
            }
        });

        root.addEventListener('click', event => {
            if (event.target === root) closeNotebook();
        });

        root.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                closeNotebook();
                return;
            }

            if (event.key !== 'Tab') return;

            const focusable = [...panel.querySelectorAll(
                'button, input, textarea, [tabindex="0"]'
            )].filter(element =>
                !element.disabled && element.getClientRects().length
            );

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (!first) {
                event.preventDefault();
                panel.focus();
                return;
            }

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });

        // Добавляем пункт в стандартное меню волшебной палочки ST.
        function attachMenuEntry() {
            const menu = document.getElementById('extensionsMenu');
            if (!menu) return false;

            if (document.getElementById('oocnb-menu-item')) return true;

            menuEntry = document.createElement('div');
            menuEntry.id = 'oocnb-menu-item';
            menuEntry.className = 'list-group-item flex-container flexGap5';
            menuEntry.tabIndex = 0;
            menuEntry.setAttribute('role', 'button');
            menuEntry.setAttribute('aria-controls', 'oocnb-panel');
            menuEntry.setAttribute('aria-expanded', 'false');

            const icon = document.createElement('span');
            icon.className = 'fa-solid fa-book';
            icon.setAttribute('aria-hidden', 'true');

            const label = document.createElement('span');
            label.textContent = 'OOC-блокнот';

            menuEntry.append(icon, label);
            menuEntry.addEventListener('click', openNotebook);

            menuEntry.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openNotebook();
                }
            });

            menu.append(menuEntry);
            return true;
        }

        if (!attachMenuEntry()) {
            const observer = new MutationObserver(() => {
                if (attachMenuEntry()) observer.disconnect();
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
