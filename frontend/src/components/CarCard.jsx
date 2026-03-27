import { useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../services/i18n.jsx';
import { useAuth } from '../services/auth/AuthContext.jsx';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const resolveAssetUrl = (url) => {
  const u = String(url || '').trim();
  if (!u) return '';
  if (u.startsWith('data:') || u.startsWith('blob:')) return u;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/')) return `${API_BASE_URL}${u}`;
  return `${API_BASE_URL}/${u}`;
};

const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#0f172a"/>
          <stop offset="1" stop-color="#27272a"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="750" fill="url(#g)"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="Arial, sans-serif" font-size="42">
        No Image
      </text>
    </svg>`
  );

const CarCard = ({ car }) => {
  const { t } = useI18n();
  const { isAuthed } = useAuth();
  const imageSrc = car?.image ? resolveAssetUrl(String(car.image)) : PLACEHOLDER_IMAGE;
  const nav = useNavigate();
  const imgRef = useRef(null);
  const category = String(car?.category || '').trim();
  const categoryLabel =
    category === 'scooter'
      ? t('category_scooter')
      : category === 'oto' || category === 'car'
        ? t('category_oto')
        : category === 'pkl' || category === 'bigbike' || category === 'underbone' || category === 'sport' || category === 'naked'
          ? t('category_pkl')
          : '';

  const computeDominantHex = async () => {
    const imgEl = imgRef.current;
    if (!imgEl) return null;
    if (!imgEl.complete || !imgEl.naturalWidth || !imgEl.naturalHeight) return null;

    const canvas = document.createElement('canvas');
    const w = 32;
    const h = 32;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    try {
      ctx.drawImage(imgEl, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let count = 0;

      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 200) continue;

        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        const saturation = max === 0 ? 0 : delta / max;
        const lightness = (max + min) / 510;

        if (saturation < 0.18) continue;
        if (lightness < 0.12 || lightness > 0.92) continue;

        rSum += r;
        gSum += g;
        bSum += b;
        count += 1;
      }

      if (!count) return null;
      const r = Math.round(rSum / count);
      const g = Math.round(gSum / count);
      const b = Math.round(bSum / count);

      const toHex = (v) => v.toString(16).padStart(2, '0');
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    } catch {
      return null;
    }
  };

  const onCustomize = async () => {
    const id = String(car?._id || '');
    if (!id) return;
    if (!isAuthed) {
      nav(`/bikes?auth=required&go=${encodeURIComponent(id)}`);
      return;
    }
    const color = await computeDominantHex();
    const qs = color ? `?color=${encodeURIComponent(color)}` : '';
    nav(`/configurator/${id}${qs}`);
  };

  const canCustomize = useMemo(() => Boolean(car?._id), [car]);
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40">
      <div className="aspect-[16/10] w-full bg-zinc-900">
        <img
          ref={imgRef}
          src={imageSrc}
          alt={car?.name || 'Car'}
          crossOrigin="anonymous"
          className="h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.src = PLACEHOLDER_IMAGE;
          }}
        />
      </div>
      <div className="space-y-3 p-4">
        <div className="text-base font-semibold">{car.name}</div>
        <div className="text-sm text-zinc-400">
          {[car.brand, categoryLabel].filter(Boolean).join(' • ') || t('carcard_default')}
        </div>
        <button
          type="button"
          disabled={!canCustomize}
          onClick={onCustomize}
          className="inline-flex items-center justify-center rounded bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500"
        >
          {t('carcard_customize')}
        </button>
      </div>
    </div>
  );
};

export default CarCard;

