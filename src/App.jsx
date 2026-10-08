import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MagnifyingGlass, IdentificationCard, GraduationCap, Briefcase, FolderSimple, PuzzlePiece, Robot, Heart, ChartLineUp, FileText, Plus, Copy, PencilSimple, Files, X, CalendarBlank, Export, GearSix, ArrowLeft, List, Trash, Check, DownloadSimple, WarningCircle, UploadSimple } from '@phosphor-icons/react';
import { defaultTopics, createRecord, makeBackup, validateBackup, mergeBackup } from './lib/data.js';
import { searchLibrary } from './lib/search.js';
import { loadLibrary, saveRecord, deleteRecord, saveTopic, restoreBackup, subscribeLibrary } from './lib/storage.js';
import { templates, templateSources, quickImportExample, parseQuickImport } from './lib/templates.js';
import { copyText } from './lib/clipboard.js';

const icons = { basic: IdentificationCard, education: GraduationCap, internship: Briefcase, projects: FolderSimple, skills: PuzzlePiece, ai: Robot, self: Heart, career: ChartLineUp, motivation: Heart };
const blankJob = { title: '', company: '', description: '', keywords: '' };
const exampleBody = '我会根据任务选择合适的 AI 工具，用于资料整理、方案比较和代码辅助。\n\n在一个课程项目中，我先拆解目标，再让模型协助生成草稿，并通过实际运行与人工检查验证结果。\n\n关键决策、事实核验和最终提交由我负责。';
const exampleTitles = ['请介绍你使用 AI 工具的经验', '多模型协作经验', '用 AI 提高工作效率', 'AI 辅助项目开发', '大模型能力与选型', 'AI 使用中的判断与复核'];
const exampleBodies = [exampleBody, '我在不同任务中尝试过多种模型，结合各自的优势进行协作。\n\n先拆解任务，再比较不同草稿。采用前核验事实和实际结果。', '我将 AI 工具应用在信息检索、文档整理和方案生成等场景。\n\n保留可追溯的资料来源，人工检查关键结论。', '在课程项目中，我使用 AI 工具辅助需求分析、原型设计和代码调试。\n\n最终结果通过实际运行与人工检查验证。', '我会根据具体任务分析模型的能力、成本和适用场景。\n\n选择工具后，用小规模任务检验效果。', '在使用 AI 工具时，我会对生成内容进行事实核验和逻辑检查。\n\n关键决策与最终提交由我负责。'];
const exampleRecords = exampleTitles.map((title, i) => ({ id: `demo-${i}`, topicId: 'ai', title, content: exampleBodies[i], jobSnapshot: { title: 'AI 产品经理', company: '示例公司', description: '负责大模型相关产品的需求调研与方案设计，跟进模型能力评估与应用落地。具备良好的信息检索与分析能力，熟悉主流大模型及其应用场景。', keywords: ['需求分析', '原型设计', 'AI 应用'] }, createdAt: '2026-10-02T08:00:00Z', updatedAt: `2026-10-02T08:00:0${6-i}Z` }));
const stamp = date => new Date(date).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
const words = text => Array.from(text || '').length;
const snapshot = value => JSON.stringify(value);
const keywordText = value => Array.isArray(value) ? value.join('、') : value || '';
const messageOf = e => e?.message || '操作未完成，请重试。';

function Modal({ title, onClose, children, wide = false, busy = false }) {
  const panel = useRef(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    panel.current?.querySelector('input, textarea, select, button')?.focus();
    const keydown = e => {
      if ([...document.querySelectorAll('[role="dialog"]')].at(-1) !== panel.current) return;
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); }
      if (e.key !== 'Tab') return;
      const all = [...panel.current.querySelectorAll('button,input,textarea,select,a[href]')].filter(el => !el.matches(':disabled') && el.getClientRects().length);
      if (!all.length) { e.preventDefault(); return; }
      if (e.shiftKey && document.activeElement === all[0]) { e.preventDefault(); all.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === all.at(-1)) { e.preventDefault(); all[0].focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus?.(); };
  }, []);
  return <div className="modal-shade" onMouseDown={e => e.target === e.currentTarget && onClose()}><section ref={panel} className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} aria-busy={busy}><header className="modal-head"><h2>{title}</h2><button disabled={busy} className="icon-button" aria-label={`关闭${title}`} onClick={onClose}><X size={22}/></button></header><fieldset disabled={busy} className="modal-fields">{children}</fieldset></section></div>;
}
function Field({ label, children, optional }) {
  const annotate = nodes => React.Children.map(nodes, child => {
    if (!React.isValidElement(child)) return child;
    if (['input', 'textarea', 'select'].includes(child.type)) return React.cloneElement(child, { 'aria-label': child.props['aria-label'] || label });
    return child.props.children ? React.cloneElement(child, {}, annotate(child.props.children)) : child;
  });
  return <label className="field"><span>{label}{optional && <small>选填</small>}</span>{annotate(children)}</label>;
}

export function App() {
  const [library, setLibrary] = useState({ topics: defaultTopics, records: [] });
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState('');
  const [text, setText] = useState(''), [role, setRole] = useState(''), [topicId, setTopicId] = useState('all');
  const [query, setQuery] = useState({ text: '', role: '', topicId: 'all' });
  const [selectedId, setSelectedId] = useState(null), [demo, setDemo] = useState(false);
  const [mobileDetail, setMobileDetail] = useState(false), [navOpen, setNavOpen] = useState(false);
  const [modal, setModal] = useState(null), [editorView, setEditorView] = useState('form');
  const [draft, setDraft] = useState(null), [baseline, setBaseline] = useState('');
  const [lastContext, setLastContext] = useState({ topicId: 'basic', isGeneral: true, job: blankJob });
  const [busy, setBusy] = useState(false), [formError, setFormError] = useState(''), [duplicate, setDuplicate] = useState(null);
  const [toast, setToast] = useState(null), [confirm, setConfirm] = useState(null);
  const [bulk, setBulk] = useState(''), [bulkPreview, setBulkPreview] = useState(null);
  const [backupText, setBackupText] = useState(''), [backupPreview, setBackupPreview] = useState(null);
  const [topicDraft, setTopicDraft] = useState({ id: '', name: '', aliases: '' });
  const [topicBaseline, setTopicBaseline] = useState(snapshot({ id: '', name: '', aliases: '' }));
  const bodyRef = useRef(null), timerRef = useRef(null), backupReadRef = useRef(0);
  const dirty = draft && snapshot(draft) !== baseline;
  const topicDirty = snapshot(topicDraft) !== topicBaseline;
  const notify = (message, type = 'success') => { clearTimeout(timerRef.current); setToast({ message, type }); timerRef.current = setTimeout(() => setToast(null), 5000); };
  const refresh = async () => { const value = await loadLibrary(); setLibrary(value); setStorageError(''); return value; };
  useEffect(() => {
    let live = true;
    loadLibrary().then(value => live && setLibrary(value)).catch(e => live && setStorageError(messageOf(e))).finally(() => live && setLoading(false));
    const unsub = subscribeLibrary(() => refresh().catch(e => setStorageError(messageOf(e))));
    return () => { live = false; unsub?.(); clearTimeout(timerRef.current); };
  }, []);
  useEffect(() => { const t = setTimeout(() => setQuery({ text, role, topicId }), 180); return () => clearTimeout(t); }, [text, role, topicId]);
  useEffect(() => { const handler = e => { if ((modal?.kind === 'editor' && (dirty || bulk.trim())) || (modal?.kind === 'topics' && topicDirty) || busy) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, [dirty, topicDirty, modal, bulk, busy]);
  const records = demo ? exampleRecords : library.records;
  const results = useMemo(() => searchLibrary(records, library.topics, query), [records, library.topics, query]);
  const selected = results.find(hit => hit.record.id === selectedId)?.record || results[0]?.record;
  const roles = [...new Set(library.records.map(r => r.jobSnapshot?.title).filter(Boolean))];
  function closeModal() {
    if (busy) return;
    if (modal?.kind === 'editor' && (dirty || bulk.trim())) { setConfirm({ title: '放弃尚未保存的内容？', description: '关闭后，当前录入或修改的内容不会保存。', label: '放弃修改', action: () => { setModal(null); setDraft(null); setBulk(''); } }); return; }
    if (modal?.kind === 'topics' && topicDirty) { setConfirm({ title: '放弃尚未保存的主题修改？', description: '主题名称和检索别名尚未保存。', label: '放弃修改', action: () => setModal(null) }); return; }
    setModal(null); setDraft(null); setBulk('');
  }
  function openEditor(record, mode = 'new', view = 'form') {
    const job = record?.jobSnapshot ? { ...record.jobSnapshot, keywords: keywordText(record.jobSnapshot.keywords) } : { ...lastContext.job };
    const value = { topicId: record?.topicId || (topicId !== 'all' ? topicId : lastContext.topicId), title: record?.title || '', content: record?.content || '', isGeneral: record ? !record.jobSnapshot : lastContext.isGeneral, job: mode === 'clone' ? { ...job, title: '', company: '' } : job };
    setDraft(value); setBaseline(snapshot(value)); setFormError(''); setDuplicate(null); setBulk(''); setBulkPreview(null); setEditorView(view); setModal({ kind: 'editor', mode, record });
  }
  function applyTemplate(t) { setDraft(d => ({ ...d, topicId: t.topicId, title: t.title, content: t.content, isGeneral: t.isGeneral, templateId: t.id })); setDuplicate(null); setFormError(''); setEditorView('form'); }
  const change = (key, value) => { setDraft(d => ({ ...d, [key]: value })); setDuplicate(null); setFormError(''); };
  const changeJob = (key, value) => { setDraft(d => ({ ...d, job: { ...d.job, [key]: value } })); setDuplicate(null); };
  async function submitRecord(keepOpen = false, allowDuplicate = false) {
    setBusy(true); setFormError('');
    try {
      const raw = { topicId: draft.topicId, title: draft.title, content: draft.content, jobSnapshot: draft.isGeneral ? null : draft.job };
      if (!draft.isGeneral && !draft.job.title.trim()) throw new Error('请填写来源岗位名称，或选择“通用信息”。');
      const record = modal.mode === 'edit' ? { ...modal.record, ...raw, updatedAt: new Date().toISOString() } : createRecord(raw, modal.mode === 'clone' && !demo ? { sourceRecordId: modal.record.id } : {});
      await saveRecord(record, { allowDuplicate }); await refresh();
      setDemo(false); setText(''); setRole(''); setTopicId('all'); setSelectedId(record.id); setMobileDetail(true);
      const context = { topicId: draft.topicId, isGeneral: draft.isGeneral, job: { ...draft.job } }; setLastContext(context);
      notify(modal.mode === 'edit' ? '修改已保存。' : '内容已保存到本机。');
      if (keepOpen) { const next = { ...context, title: '', content: '' }; setDraft(next); setBaseline(snapshot(next)); setDuplicate(null); setModal({ kind: 'editor', mode: 'new' }); }
      else { setModal(null); setDraft(null); }
    } catch (e) { if (e.code === 'DUPLICATE') { setDuplicate(e.record); setFormError('发现完全相同的记录，可以查看已有内容，或仍然另存。'); } else setFormError(messageOf(e)); }
    finally { setBusy(false); }
  }
  async function copyContent() {
    if (!selected) return;
    const result = await copyText(selected.content, { clipboard: navigator.clipboard, selectFallback: () => { bodyRef.current?.focus(); bodyRef.current?.select(); } });
    notify(result.copied ? '已复制完整正文，保留换行。' : '浏览器未允许自动复制，正文已选中，请按 Ctrl+C。', result.copied ? 'success' : 'warning');
  }
  async function removeSelected(record) { setBusy(true); try { await deleteRecord(record.id); await refresh(); setSelectedId(null); setMobileDetail(false); notify('记录已删除。'); } catch (e) { notify(messageOf(e), 'error'); } finally { setBusy(false); } }
  const backupJSON = () => JSON.stringify(makeBackup(library.topics, library.records), null, 2);
  function downloadBackup() {
    const url = URL.createObjectURL(new Blob([backupJSON()], { type: 'application/json;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `投递素材库备份-${stamp(new Date())}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000); notify('已发起备份下载，请在浏览器中确认文件。');
  }
  function previewBackup(raw) { setFormError(''); setBackupPreview(null); try { const backup = validateBackup(JSON.parse(raw)); setBackupPreview({ backup, merged: mergeBackup(library, backup) }); } catch (e) { setFormError(`无法恢复：${e instanceof SyntaxError ? '内容不是有效的 JSON，请选择完整备份。' : messageOf(e)}`); } }
  async function readBackupFile(e) {
    const file = e.target.files?.[0], readId = ++backupReadRef.current;
    setBackupPreview(null); setBackupText(''); setFormError('');
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setFormError('请选择小于 10 MB 的备份文件。'); return; }
    setBusy(true);
    try { const raw = await file.text(); if (readId === backupReadRef.current) { setBackupText(raw); previewBackup(raw); } }
    catch (error) { if (readId === backupReadRef.current) setFormError(messageOf(error)); }
    finally { if (readId === backupReadRef.current) setBusy(false); }
  }
  async function restore() { if (!backupPreview) return; setBusy(true); try { const result = await restoreBackup(backupPreview.backup); await refresh(); setBackupPreview(null); setBackupText(''); setDemo(false); setModal(null); notify(`恢复完成：新增 ${result.added} 条，跳过 ${result.skipped} 条重复内容。`); } catch (e) { setFormError(messageOf(e)); } finally { setBusy(false); } }
  async function saveBulk() { if (!bulkPreview) return; setBusy(true); setFormError(''); try { const result = await restoreBackup(makeBackup(library.topics, bulkPreview.map(d => createRecord(d)))); await refresh(); setDemo(false); setBulk(''); setBulkPreview(null); setModal(null); setDraft(null); setText(''); setRole(''); setTopicId('all'); notify(`导入完成：新增 ${result.added} 条，跳过 ${result.skipped} 条重复内容。`); } catch (e) { setFormError(messageOf(e)); } finally { setBusy(false); } }
  async function submitTopic() {
    setBusy(true); setFormError('');
    try { const name = topicDraft.name.trim(); if (!name) throw new Error('请填写主题名称。'); if (library.topics.some(t => t.id !== topicDraft.id && t.name.trim() === name)) throw new Error('已有同名主题，请选择该主题修改。'); await saveTopic({ id: topicDraft.id || crypto.randomUUID(), name, aliases: topicDraft.aliases.split(/[,，、;；\n]/).map(s => s.trim()).filter(Boolean) }); await refresh(); const blank = { id: '', name: '', aliases: '' }; setTopicDraft(blank); setTopicBaseline(snapshot(blank)); notify('主题已保存。'); } catch (e) { setFormError(messageOf(e)); } finally { setBusy(false); }
  }
  function chooseTopicDraft(value) {
    const apply = () => { setTopicDraft(value); setTopicBaseline(snapshot(value)); setFormError(''); };
    if (topicDirty) setConfirm({ title: '切换主题前放弃修改？', description: '当前主题名称和检索别名尚未保存。', label: '放弃并切换', action: apply });
    else apply();
  }
  function openTopics() { const blank = { id: '', name: '', aliases: '' }; setTopicDraft(blank); setTopicBaseline(snapshot(blank)); setFormError(''); setModal({ kind: 'topics' }); }
  const selectTopic = id => { setTopicId(id); setSelectedId(null); setMobileDetail(false); setNavOpen(false); };
  const showDemo = () => { setDemo(true); setTopicId('ai'); setText('大模型使用经验'); setRole('大模型产品经理'); setSelectedId('demo-0'); setMobileDetail(false); };
  function changeEditorView(view) { if (view !== 'form' && dirty) { setConfirm({ title: '切换录入方式？', description: '当前表单仍会保留；选择新模板会替换主题、问题和正文。', label: '切换', action: () => { setEditorView(view); setFormError(''); } }); } else { setEditorView(view); setFormError(''); } }

  return <div className="app-shell">
    <aside className={`sidebar ${navOpen ? 'nav-open' : ''}`}>
      <div className="brand">投递素材库<button className="icon-button mobile-only" onClick={() => setNavOpen(false)} aria-label="关闭主题导航"><X size={20}/></button></div>
      <nav aria-label="资料主题"><button className={`nav-item ${topicId === 'all' ? 'active' : ''}`} onClick={() => selectTopic('all')}><FileText size={22}/>全部内容</button>{library.topics.map(t => { const Icon = icons[t.id] || FolderSimple; return <button className={`nav-item ${topicId === t.id ? 'active' : ''}`} key={t.id} onClick={() => selectTopic(t.id)}><Icon size={22}/><span>{t.name}</span></button>; })}</nav>
      <div className="sidebar-create"><button className="button primary" onClick={() => openEditor(null)} disabled={loading || !!storageError}><Plus size={20}/>录入内容</button><button className="template-link" onClick={() => openEditor(null, 'new', 'templates')} disabled={loading || !!storageError}><Files size={17}/>从模板快速录入</button></div>
      <div className="sidebar-bottom"><p>资料仅保存在此浏览器</p><button onClick={openTopics}><GearSix size={18}/>管理主题</button><button onClick={() => { setFormError(''); setBackupPreview(null); setBackupText(''); setModal({ kind: 'backup' }); }}><Export size={18}/>备份与恢复</button></div>
    </aside>
    {navOpen && <button className="nav-backdrop" aria-label="关闭主题导航背景" onClick={() => setNavOpen(false)}/>}
    <main className="workspace">
      <header className="topbar"><button className="icon-button mobile-only" aria-label="打开主题导航" onClick={() => setNavOpen(true)}><List size={24}/></button><div className="quick-search"><MagnifyingGlass size={20}/><input aria-label="快速搜索" placeholder="快速搜索问题、主题或内容…" value={text} onChange={e => setText(e.target.value)}/>{text && <button className="icon-button" aria-label="清除快速搜索" onClick={() => setText('')}><X size={17}/></button>}</div><span className="today"><CalendarBlank size={21}/>{stamp(new Date())}</span><button className="button primary mobile-only" onClick={() => openEditor(null)} disabled={loading || !!storageError}><Plus size={18}/>录入</button></header>
      {storageError && <div className="storage-error" role="alert"><WarningCircle size={20}/>本地存储暂不可用：{storageError}<button onClick={() => refresh().catch(e => setStorageError(messageOf(e)))}>重新加载</button></div>}
      {demo && <div className="demo-banner"><span>虚构示例 · 未写入资料库</span><button onClick={() => { setDemo(false); setText(''); setRole(''); setTopicId('all'); setSelectedId(null); }}>返回我的资料</button></div>}
      <div className={`workbench ${mobileDetail ? 'show-detail' : ''}`}>
        <section className="index-pane" aria-label="搜索与结果">
          <div className="filters"><Field label="问题 / 主题"><div className="input-with-icon"><MagnifyingGlass size={19}/><input placeholder="例如：项目经历、大模型使用经验" value={text} onChange={e => setText(e.target.value)}/>{text && <button aria-label="清除问题搜索" className="icon-button" onClick={() => setText('')}><X size={17}/></button>}</div></Field><Field label="主题"><select value={topicId} onChange={e => selectTopic(e.target.value)}><option value="all">全部主题</option>{library.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field><Field label="目标岗位"><div className="input-with-icon"><input list="recent-roles" placeholder="例如：AI 产品经理（可不填）" value={role} onChange={e => setRole(e.target.value)}/>{role && <button className="icon-button" aria-label="清除岗位条件" onClick={() => setRole('')}><X size={17}/></button>}</div><datalist id="recent-roles">{roles.map(r => <option key={r} value={r}/>)}</datalist></Field><div className="result-count">{loading ? '正在加载本地资料…' : `共 ${results.length} 条结果`}{(text || role) && <button className="text-button" onClick={() => { setText(''); setRole(''); }}>清除搜索</button>}</div></div>
          <div className="result-list">{results.map(({ record, reasons }) => <button className={`result-row ${selected?.id === record.id ? 'selected' : ''}`} key={record.id} onClick={() => { setSelectedId(record.id); setMobileDetail(true); }}><div className="result-heading"><h3>{record.title}</h3>{reasons.length > 0 && <div className="reasons">{reasons.slice(0, 2).map(reason => <span key={reason}>{reason}</span>)}</div>}</div><p className="result-meta">{library.topics.find(t => t.id === record.topicId)?.name}　|　{record.jobSnapshot ? `${record.jobSnapshot.title}${record.jobSnapshot.company ? ` · ${record.jobSnapshot.company}` : ''}` : '通用内容'}</p><p className="result-excerpt">{record.content.replace(/\s+/g, ' ')}</p></button>)}
          {!loading && !results.length && <div className="empty-index"><FolderSimple size={36} weight="light"/><h3>{library.records.length || demo ? '没有找到相关内容' : '把填写过的内容存下来'}</h3><p>{library.records.length || demo ? '试试更短的关键词，或放宽主题与岗位条件。' : '第一次填写时保存，下次投递就能快速找回。'}</p>{library.records.length || demo ? <><button className="button secondary" onClick={() => setRole('')}>清除岗位条件</button><button className="text-button" onClick={() => { setText(''); setRole(''); selectTopic('all'); }}>查看全部内容</button></> : <><button className="button primary" onClick={() => openEditor(null, 'new', 'templates')} disabled={!!storageError}>从模板开始</button><button className="text-button" onClick={showDemo}>先看看示例</button></>}</div>}</div>
        </section>
        <section className="detail-pane" aria-label="完整内容">
          {selected ? <><button className="text-button detail-back" onClick={() => setMobileDetail(false)}><ArrowLeft size={18}/>返回结果列表</button><div className="detail-heading"><h1>{selected.title}</h1><div className="detail-meta"><span>{selected.jobSnapshot ? `${selected.jobSnapshot.title}${selected.jobSnapshot.company ? ` · ${selected.jobSnapshot.company}` : ''}` : '通用内容 · 可用于不同岗位'}</span>{demo && <span className="badge">示例资料</span>}<span className="detail-date">{words(selected.content)} 字 · 更新于 {stamp(selected.updatedAt)}</span></div></div><textarea className="answer-body" aria-label="完整正文" ref={bodyRef} value={selected.content} readOnly spellCheck={false}/><div className="detail-actions"><button className="button primary" onClick={copyContent}><Copy size={20}/>复制全文</button><button className="button secondary" onClick={() => openEditor(selected, demo ? 'clone' : 'edit')}><PencilSimple size={20}/>{demo ? '以此为草稿' : '编辑'}</button><button className="button secondary" onClick={() => openEditor(selected, 'clone')}><Files size={20}/>修改后另存</button>{!demo && <button className="icon-button delete-button" aria-label="删除当前记录" onClick={() => setConfirm({ title: '删除这条记录？', description: `“${selected.title}”将从此浏览器移除。建议先导出备份。`, label: '删除记录', danger: true, action: () => removeSelected(selected) })}><Trash size={20}/></button>}</div><div className="source-section"><h2>来源岗位信息</h2>{selected.jobSnapshot ? <div className="source-well"><h3>{selected.jobSnapshot.title}{selected.jobSnapshot.company && ` · ${selected.jobSnapshot.company}`}</h3>{selected.jobSnapshot.description && <p>{selected.jobSnapshot.description}</p>}{keywordText(selected.jobSnapshot.keywords) && <p className="keywords">岗位关键词：{keywordText(selected.jobSnapshot.keywords)}</p>}{!selected.jobSnapshot.description && !keywordText(selected.jobSnapshot.keywords) && <p>尚未附加岗位描述；编辑时可以补充。</p>}</div> : <p className="muted">这是一条通用信息，不关联特定岗位。</p>}{selected.sourceRecordId && <p className="source-record">另存来源：{library.records.find(r => r.id === selected.sourceRecordId)?.title || '原记录已不在当前资料库'}</p>}</div></> : <div className="empty-detail"><FileText size={44} weight="light"/><h1>找到合适的回答，一键复制</h1><p>选择左侧结果，完整正文和来源岗位会显示在这里。</p><div className="starter-actions"><button className="button secondary" onClick={() => openEditor(null, 'new', 'templates')} disabled={loading || !!storageError}><Files size={19}/>浏览录入模板</button><button className="text-button" onClick={showDemo}>查看虚构示例</button></div><div className="local-note">按主题整理 · 按近似岗位检索 · 保留每次填写的版本</div></div>}
        </section>
      </div>
    </main>
    {toast && <div className={`toast toast-${toast.type}`} role="status" aria-live="polite">{toast.type === 'success' ? <Check size={20}/> : <WarningCircle size={20}/>}<span>{toast.message}</span><button className="icon-button" aria-label="关闭提示" onClick={() => setToast(null)}><X size={17}/></button></div>}
    {modal?.kind === 'editor' && <Modal title={modal.mode === 'edit' ? '编辑内容' : modal.mode === 'clone' ? '修改后另存' : '录入内容'} onClose={closeModal} busy={busy} wide>
      {modal.mode === 'new' && <div className="editor-tabs" role="tablist" aria-label="录入方式">{[['form', '手动录入'], ['templates', '常用模板'], ['bulk', '批量粘贴']].map(([value, label]) => <button role="tab" aria-selected={editorView === value} key={value} onClick={() => changeEditorView(value)}>{label}</button>)}</div>}
      {editorView === 'templates' ? <div className="modal-body"><p className="intro-text">选择一个填写结构，再替换为你自己的信息。模板不会自动写入资料库。</p><div className="template-grid">{templates.map(t => <article className="template-card" key={t.id}><span className="template-topic">{library.topics.find(topic => topic.id === t.topicId)?.name}</span><h3>{t.name}</h3><p>{t.description}</p><button className="button secondary" aria-label={`使用${t.name}模板`} onClick={() => applyTemplate(t)}>使用模板</button></article>)}</div><div className="template-sources"><h3>格式参考</h3>{templateSources.map(s => <p key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a><span>{s.note}</span></p>)}<p>中文模板为原创整理；方括号内是待替换内容，不代表你已有的经历。</p><a href="/templates/网申录入模板.md" download>下载批量录入格式（Markdown）</a></div></div> : editorView === 'bulk' ? <><div className="modal-body"><p className="intro-text">按“主题、问题、岗位、正文”的格式粘贴多条内容。先预览，再一次性保存。</p><div className="bulk-tools"><button className="text-button" onClick={() => { setBulk(quickImportExample); setBulkPreview(null); }}>填入格式示例</button><a href="/templates/网申录入模板.md" download>下载格式模板</a></div><Field label="批量录入文本"><textarea className="bulk-text" value={bulk} placeholder={'## 内容 1\n主题：项目经历\n问题：请介绍一个项目\n岗位：产品经理\n正文：\n粘贴你的实际回答…'} onChange={e => { setBulk(e.target.value); setBulkPreview(null); setFormError(''); }}/></Field>{bulkPreview && <div className="import-preview"><strong>已识别 {bulkPreview.length} 条内容</strong>{bulkPreview.map((r, i) => <p key={i}>{i + 1}. {r.title} · {library.topics.find(t => t.id === r.topicId)?.name} · {r.jobSnapshot?.title || '通用内容'}</p>)}<small>检查正文中的占位内容是否已替换；完全重复的记录会自动跳过。</small></div>}{formError && <div className="inline-error" role="alert">{formError}</div>}</div><footer className="modal-footer"><button className="button secondary" onClick={closeModal}>取消</button><button className="button secondary" disabled={busy || !bulk.trim()} onClick={() => { try { setBulkPreview(parseQuickImport(bulk)); setFormError(''); } catch (e) { setBulkPreview(null); setFormError(messageOf(e)); } }}>预览导入</button><button className="button primary" disabled={busy || !bulkPreview?.length} onClick={saveBulk}>{busy ? '正在保存…' : '确认导入'}</button></footer></> : <>
        <div className="modal-body"><div className="form-grid"><Field label="主题"><select value={draft.topicId} onChange={e => change('topicId', e.target.value)}>{library.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field><Field label="内容类型"><select value={draft.isGeneral ? 'general' : 'job'} onChange={e => change('isGeneral', e.target.value === 'general')}><option value="general">通用信息（不关联岗位）</option><option value="job">岗位问答（关联来源岗位）</option></select></Field></div><Field label="内容名称 / 原问题"><input value={draft.title} placeholder="例如：手机号、请介绍你的项目经历" onChange={e => change('title', e.target.value)}/></Field><Field label="填写内容"><textarea className="editor-content" value={draft.content} onChange={e => change('content', e.target.value)} placeholder="粘贴填写过的完整内容，换行会保留。"/></Field><div className="editor-count">{words(draft.content)} 字{draft.templateId && <span>请替换模板中的方括号占位内容。</span>}</div>{!draft.isGeneral && <div className="job-fields"><h3>来源岗位</h3><div className="form-grid"><Field label="岗位名称"><input value={draft.job.title} placeholder={modal.mode === 'clone' ? '填写此次投递的新岗位' : '例如：AI 产品经理'} onChange={e => changeJob('title', e.target.value)}/></Field><Field label="公司" optional><input value={draft.job.company} placeholder="例如：公司名称" onChange={e => changeJob('company', e.target.value)}/></Field></div><Field label="岗位关键词" optional><input value={draft.job.keywords} placeholder="需求分析、原型设计、AI 应用" onChange={e => changeJob('keywords', e.target.value)}/></Field><Field label="岗位描述（JD）" optional><textarea rows={3} value={draft.job.description} placeholder="粘贴该岗位的职责与要求，便于以后判断是否适用。" onChange={e => changeJob('description', e.target.value)}/></Field></div>}{modal.mode === 'clone' && <p className="info-note">将保存为新记录，原回答保留。请检查公司名称和回答内容是否适用于新岗位。</p>}{formError && <div className="inline-error" role="alert">{formError}{duplicate && <div className="duplicate-actions"><button className="text-button" onClick={() => { setModal(null); setDraft(null); setDemo(false); setText(''); setRole(''); setTopicId('all'); setSelectedId(duplicate.id); setMobileDetail(true); }}>查看已有记录</button><button className="text-button" disabled={busy} onClick={() => submitRecord(false, true)}>仍然另存一条</button></div>}</div>}</div><footer className="modal-footer"><button className="button secondary" onClick={closeModal} disabled={busy}>取消</button>{modal.mode === 'new' && <button className="button secondary" disabled={busy} onClick={() => submitRecord(true)}>保存并继续录入</button>}<button className="button primary" disabled={busy} onClick={() => submitRecord(false)}>{busy ? '正在保存…' : modal.mode === 'edit' ? '保存修改' : '保存内容'}</button></footer>
      </>}
    </Modal>}
    {modal?.kind === 'topics' && <Modal title="管理主题" onClose={closeModal} busy={busy}><div className="modal-body"><p className="intro-text">主题用于整理内容；别名帮助你用不同的说法找回同一主题。</p><div className="topic-edit-list">{library.topics.map(t => <button key={t.id} className={topicDraft.id === t.id ? 'active' : ''} onClick={() => chooseTopicDraft({ id: t.id, name: t.name, aliases: (t.aliases || []).join('、') })}><span>{t.name}</span><PencilSimple size={16}/></button>)}</div><button className="text-button" onClick={() => chooseTopicDraft({ id: '', name: '', aliases: '' })}><Plus size={16}/>新建主题</button><Field label="主题名称"><input value={topicDraft.name} onChange={e => setTopicDraft(d => ({ ...d, name: e.target.value }))} placeholder="例如：团队协作"/></Field><Field label="检索别名" optional><textarea rows={3} value={topicDraft.aliases} onChange={e => setTopicDraft(d => ({ ...d, aliases: e.target.value }))} placeholder="用逗号或顿号分隔，例如：合作经历、沟通协调"/></Field>{formError && <div className="inline-error" role="alert">{formError}</div>}</div><footer className="modal-footer"><button className="button secondary" onClick={closeModal}>关闭</button><button className="button primary" disabled={busy} onClick={submitTopic}>{busy ? '正在保存…' : topicDraft.id ? '保存主题修改' : '添加主题'}</button></footer></Modal>}
    {modal?.kind === 'backup' && <Modal title="备份与恢复" onClose={closeModal} busy={busy}><div className="modal-body"><div className="backup-section"><h3>导出你的资料</h3><p>包含 {library.records.length} 条内容和全部主题。备份是本地 JSON 文件，可用于迁移或恢复。</p><button className="button primary" onClick={downloadBackup}><DownloadSimple size={19}/>下载备份</button><button className="button secondary backup-text-button" onClick={() => { setBackupText(backupJSON()); setBackupPreview(null); setFormError(''); }}>显示备份文本</button></div><div className="backup-section"><h3>恢复备份</h3><p>先检查导入数量；重复项跳过，冲突项另存，已有内容保留。</p><label className="file-picker"><UploadSimple size={19}/><span>选择 JSON 备份文件</span><input type="file" accept=".json,application/json" aria-label="选择备份文件" onChange={readBackupFile}/></label><Field label="或粘贴备份 JSON"><textarea rows={4} value={backupText} onChange={e => { setBackupText(e.target.value); setBackupPreview(null); setFormError(''); }} placeholder="粘贴之前导出的完整备份 JSON…"/></Field><button className="button secondary" onClick={() => previewBackup(backupText)} disabled={!backupText.trim() || busy}>检查备份</button>{backupPreview && <div className="import-preview"><strong>备份检查通过</strong><p>新增 {backupPreview.merged.added} 条 · 跳过 {backupPreview.merged.skipped} 条重复内容 · {backupPreview.merged.conflicts} 条冲突另存</p></div>}{formError && <div className="inline-error" role="alert">{formError}</div>}</div><p className="info-note">浏览器资料与本地地址、浏览器用户资料关联。清理浏览器数据或更换浏览器后，可用备份恢复。</p></div><footer className="modal-footer"><button className="button secondary" disabled={busy} onClick={closeModal}>关闭</button><button className="button primary" disabled={busy || !backupPreview} onClick={restore}>{busy ? '正在恢复…' : '确认恢复'}</button></footer></Modal>}
    {confirm && <Modal title={confirm.title} onClose={() => setConfirm(null)}><div className="modal-body"><p>{confirm.description}</p></div><footer className="modal-footer"><button className="button secondary" onClick={() => setConfirm(null)}>继续保留</button><button className={`button ${confirm.danger ? 'danger' : 'primary'}`} onClick={() => { const action = confirm.action; setConfirm(null); action(); }}>{confirm.label}</button></footer></Modal>}
  </div>;
}
