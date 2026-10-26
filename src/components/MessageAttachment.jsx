import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/http.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { fileSize } from '../utils/messageContent.js';
import { PaperclipIcon } from './icons.jsx';

export default function MessageAttachment({ attachment }) {
  const { t } = useI18n();
  const image = /^image\/(jpeg|png|webp)$/.test(attachment.contentType);
  const [url, setUrl] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [failed, setFailed] = useState(false);
  const { data: blob, isError, refetch } = useQuery({
    queryKey: ['attachment', attachment.url],
    queryFn: async () => (await api.get(attachment.url, { responseType: 'blob' })).data,
    enabled: image && Boolean(attachment.url) && !attachment.blob,
    staleTime: Infinity,
    retry: 1,
  });
  const content = attachment.blob ?? blob;
  useEffect(() => {
    if (!content) { setUrl(null); return undefined; }
    const value = URL.createObjectURL(content);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [content]);

  const download = async (event) => {
    event.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    setFailed(false);
    try {
      const file = content ?? (await api.get(attachment.url, { responseType: 'blob' })).data;
      const href = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = href;
      link.download = attachment.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch { setFailed(true); }
    finally { setDownloading(false); }
  };

  return (
    <div className="attachment">
      {image && (url ? <img className="attachment__image" src={url} alt={attachment.name} /> :
        <div className="attachment__placeholder">{isError ? t('chat.attachmentFailed') : t('common.loading')}</div>)}
      <button type="button" className="attachment__download" onClick={download} disabled={downloading} title={t('chat.download')}>
        <span className="attachment__icon"><PaperclipIcon /></span>
        <span className="attachment__details"><strong>{attachment.name}</strong><small>{fileSize(attachment.size)} · {downloading ? t('common.loading') : t('chat.download')}</small></span>
        <span aria-hidden="true">↓</span>
      </button>
      {(failed || isError) && <button type="button" className="btn-link" onClick={(e) => { e.stopPropagation(); if (image) refetch(); else download(e); }}>{t('chat.retry')}</button>}
    </div>
  );
}
