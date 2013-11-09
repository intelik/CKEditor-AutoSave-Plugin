﻿/**
 * @license Copyright (c) CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.html or http://ckeditor.com/license
 */

(function () {
    if (!supportsLocalStorage()) {
        return;
    }
   
    CKEDITOR.plugins.add("autosave", {
        lang: ['de', 'en', 'jp', 'pl', 'pt-BR', 'zh', 'zh-cn'],
        version: 0.6,
        init: function (editor) {
            var autoSaveKey = editor.config.autosave_SaveKey != null ? editor.config.autosave_SaveKey : 'autosave_' + window.location;
            var notOlderThan = editor.config.autosave_NotOlderThan != null ? editor.autosave_NotOlderThan : 1440;

            CKEDITOR.document.appendStyleSheet(this.path + 'css/autosave.min.css');

            CKEDITOR.scriptLoader.load(this.path + 'js/extensions.min.js', function () {
                GenerateAutoSaveDialog(editor, autoSaveKey);

                CheckForAutoSavedContent(editor, autoSaveKey, notOlderThan);
            });

            editor.on('key', startTimer);

            editor.on('destroy', function () {
                SaveData(autoSaveKey, editor);
            });
            
            editor.on('uiSpace', function (event) {
                if (event.data.space == 'bottom') {
                    event.data.html += '<div class="autoSaveMessage" unselectable="on"><div unselectable="on" id="' + autoSaveMessageId(event.editor) + '"class="hidden"' + '>Auto Saved</div></div>';
                }
            }, editor, null, 100);
            
            
        }
    });
    
    function autoSaveMessageId(editorInstance) {
        return 'cke_autoSaveMessage_' + editorInstance.name;
    }

    var timeOutId = 0,
        savingActive = false;

    var startTimer = function (event) {
        if (timeOutId) {
            clearTimeout(timeOutId);
        }
        var delay = CKEDITOR.config.autosave_delay != null ? CKEDITOR.config.autosave_delay : 10;
        timeOutId = setTimeout(onTimer, delay * 1000, event);
    };
    var onTimer = function (event) {
        if (savingActive) {
            startTimer(event);
        } else if (event.editor.checkDirty() || event.editor.plugins.bbcode) {
            savingActive = true;
            var editor = event.editor,
                autoSaveKey = editor.config.autosave_SaveKey != null ? editor.config.autosave_SaveKey : 'autosave_' + window.location;

            SaveData(autoSaveKey, editor);

            savingActive = false;
        } 
    };

    // localStorage detection
    function supportsLocalStorage() {
        return typeof (Storage) !== 'undefined';
    }
    
    function GenerateAutoSaveDialog(editorInstance, autoSaveKey) {
        CKEDITOR.dialog.add('autosaveDialog', function () {
            return {
                title: editorInstance.lang.autosave.title,
                minHeight: 155,
                height: 300,
                width: 750,
                onShow: function () {
                    RenderDiff(this, editorInstance, autoSaveKey);
                },
                onOk: function () {
                    var jsonSavedContent = LoadData(autoSaveKey);
                    
                    editorInstance.setData(jsonSavedContent.data);
                    
                    RemoveStorage(autoSaveKey);
                },
                onCancel: function () {
                    RemoveStorage(autoSaveKey);
                },
                contents: [{
                    label: '',
                    id: 'general',
                    elements: [{
                        type: 'radio',
                        id: 'diffType',
                        label: editorInstance.lang.autosave.diffType,
                        items: [[editorInstance.lang.autosave.sideBySide, 'sideBySide'], [editorInstance.lang.autosave.inline, 'inline']],
                        'default': 'sideBySide',
                        onClick: function () {
                            RenderDiff(this._.dialog, editorInstance, autoSaveKey);
                        }
                    },{
                        type: 'html',
                        id: 'diffContent',
                        html: ''
                    }]
                }],
                buttons: [
                    {
                        id: 'ok',
                        type: 'button',
                        label: editorInstance.lang.autosave.ok,
                        'class': 'cke_dialog_ui_button_ok',
                        onClick: function (evt) {
                            var dialog = evt.data.dialog;
                            if (dialog.fire('ok', { hide: true }).hide !== false)
                                dialog.hide();
                        }
                    },
                    {
                        id: 'cancel',
                        type: 'button',
                        label: editorInstance.lang.common.cancel,
                        'class': 'cke_dialog_ui_button_cancel',
                        onClick: function (evt) {
                            var dialog = evt.data.dialog;
                            if (dialog.fire('cancel', { hide: true }).hide !== false)
                                dialog.hide();
                        }
                    }
                ]
            };
        });
    }
    
    function CheckForAutoSavedContent(editorInstance, autoSaveKey, notOlderThan) {
        // Checks If there is data available and load it
        if (localStorage.getItem(autoSaveKey)) {
            var jsonSavedContent = LoadData(autoSaveKey);

            var autoSavedContent = jsonSavedContent.data;
            var autoSavedContentDate = jsonSavedContent.saveTime;

            var editorLoadedContent = editorInstance.getData();

            // check if the loaded editor content is the same as the autosaved content
            if (editorLoadedContent == autoSavedContent) {
                localStorage.removeItem(autoSaveKey);
                return;
            }

            // Ignore if autosaved content is older then x minutes
            if (moment(new Date()).diff(autoSavedContentDate, 'minutes') > notOlderThan) {
                RemoveStorage(autoSaveKey);

                return;
            }

            var confirmMessage = editorInstance.lang.autosave.loadSavedContent.replace("{0}", moment(autoSavedContentDate).lang(editorInstance.config.language).format('LLL'));
            if (confirm(confirmMessage)) {
                // Open DIFF Dialog
                editorInstance.openDialog('autosaveDialog');
            } else {
                RemoveStorage(autoSaveKey);
            }
        }
    }
    
    function LoadData(autoSaveKey) {
        var compressedJSON = LZString.decompressFromUTF16(localStorage.getItem(autoSaveKey));
        return JSON.parse(compressedJSON);
    }
    
    function SaveData(autoSaveKey, editorInstance) {
        var compressedJSON = LZString.compressToUTF16(JSON.stringify({ data: editorInstance.getData(), saveTime: new Date() }));
        localStorage.setItem(autoSaveKey, compressedJSON);

        var autoSaveMessage = document.getElementById(autoSaveMessageId(editorInstance));

        if (autoSaveMessage) {
            autoSaveMessage.className = "show";

            setTimeout(function() {
                autoSaveMessage.className = "hidden";
            }, 2000);
        }
    }
    
    function RemoveStorage(autoSaveKey) {
       // localStorage.removeItem(autoSaveKey);
    }
    
    function RenderDiff(dialog, editorInstance, autoSaveKey) {
        var jsonSavedContent = LoadData(autoSaveKey);

        var base = difflib.stringAsLines(editorInstance.getData());
        var newtxt = difflib.stringAsLines(jsonSavedContent.data);
        var sm = new difflib.SequenceMatcher(base, newtxt);
        var opcodes = sm.get_opcodes();

        dialog.getContentElement('general', 'diffContent').getElement().setHtml('<div class="diffContent">' + diffview.buildView({
            baseTextLines: base,
            newTextLines: newtxt,
            opcodes: opcodes,
            baseTextName: editorInstance.lang.autosave.loadedContent,
            newTextName: editorInstance.lang.autosave.autoSavedContent + (moment(jsonSavedContent.saveTime).lang(editorInstance.config.language).format('LLL')) + '\')',
            contextSize: 3,
            viewType: dialog.getContentElement('general', 'diffType').getValue() == "inline" ? 1 : 0
        }).outerHTML + '</div>');
    }

})();