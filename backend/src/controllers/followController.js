const mongoose = require('mongoose');

const Part = require('../models/Part');
const Configuration = require('../models/Configuration');
const UserFollowItem = require('../models/UserFollowItem');
const { asyncHandler } = require('../middleware/asyncHandler');
const { createNotification } = require('../services/notifications');

const normalizeItemType = (value) => {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'part' || v === 'product') return 'part';
  if (v === 'build' || v === 'configuration') return 'build';
  return '';
};

const normalizeId = (value) => String(value || '').trim();

const buildLegalWarnings = (parts) => {
  const warnings = [];
  const types = new Set((Array.isArray(parts) ? parts : []).map((p) => String(p?.type || '').trim()).filter(Boolean));
  if (types.has('exhaust'))
    warnings.push(
      'Cảnh báo (VN): Độ pô/ống xả có thể vượt ngưỡng tiếng ồn/khí thải theo quy định. Nên ưu tiên pô zin hoặc pô có tiêu âm (DB killer) và kiểm tra quy định hiện hành trước khi lưu thông.'
    );
  if (types.has('lighting'))
    warnings.push(
      'Cảnh báo (VN): Độ đèn phải đảm bảo an toàn giao thông (không gây chói/mất tập trung) và tuân thủ quy định hiện hành khi tham gia giao thông.'
    );
  if (types.has('bodykit'))
    warnings.push(
      'Cảnh báo (VN): Thay đổi dàn áo/body kit có thể bị coi là thay đổi kết cấu/hình dáng phương tiện trong một số trường hợp. Hãy kiểm tra yêu cầu kiểm định/đăng ký (nếu có) trước khi sử dụng.'
    );
  if (types.has('tire') || types.has('wheels'))
    warnings.push(
      'Cảnh báo (VN): Thay mâm/lốp nên đảm bảo đúng kích thước, tải trọng và không cạ vào khung/sườn để tránh mất an toàn khi vận hành.'
    );
  return warnings;
};

const toggleFollow = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const itemType = normalizeItemType(req.body?.itemType || req.body?.type);
  const itemId = normalizeId(req.body?.itemId || req.body?.id);
  if (!itemType || !mongoose.isValidObjectId(itemId)) return res.status(400).json({ error: 'INVALID_ITEM' });

  if (itemType === 'part') {
    const ok = await Part.exists({ _id: itemId });
    if (!ok) return res.status(404).json({ error: 'NOT_FOUND' });
  } else if (itemType === 'build') {
    const ok = await Configuration.exists({ _id: itemId });
    if (!ok) return res.status(404).json({ error: 'NOT_FOUND' });
  }

  const existing = await UserFollowItem.findOne({ userId, itemType, itemId }).select('_id').lean();
  if (existing) {
    await UserFollowItem.deleteOne({ _id: existing._id });
    return res.json({ ok: true, following: false });
  }

  await UserFollowItem.create({ userId, itemType, itemId });

  if (itemType === 'build') {
    const cfg = await Configuration.findById(itemId)
      .populate('selectedWheels', 'type')
      .populate('selectedParts', 'type')
      .populate('carId', 'name')
      .select('_id name carId selectedWheels selectedParts')
      .lean();
    const parts = [];
    if (cfg?.selectedWheels) parts.push(cfg.selectedWheels);
    if (Array.isArray(cfg?.selectedParts)) parts.push(...cfg.selectedParts);
    const legalWarnings = buildLegalWarnings(parts);
    if (legalWarnings.length) {
      const title = String(cfg?.name || cfg?.carId?.name || '').trim() || `Build ${String(cfg?._id || '')}`;
      await createNotification({
        userId,
        type: 'LEGAL_RISK',
        content: `Build bạn vừa theo dõi có cảnh báo pháp lý: ${title}`,
        meta: { itemType: 'build', itemId: String(cfg?._id || ''), warnings: legalWarnings.slice(0, 6) }
      });
    }
  }

  res.json({ ok: true, following: true });
});

const getFollowStatus = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const itemType = normalizeItemType(req.query?.itemType || req.query?.type);
  const itemId = normalizeId(req.query?.itemId || req.query?.id);
  if (!itemType || !mongoose.isValidObjectId(itemId)) return res.status(400).json({ error: 'INVALID_ITEM' });
  const existing = await UserFollowItem.findOne({ userId, itemType, itemId }).select('_id').lean();
  res.json({ ok: true, following: Boolean(existing) });
});

const listFollowing = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const itemType = normalizeItemType(req.query?.itemType || req.query?.type);
  const typeFilter = itemType ? { itemType } : {};
  const limitRaw = Number(req.query?.limit);
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 30;

  const rows = await UserFollowItem.find({ userId, ...typeFilter })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const ids = rows.map((r) => String(r?.itemId || '')).filter(Boolean);

  if (itemType === 'part') {
    const parts = await Part.find({ _id: { $in: ids } })
      .select('_id name type price thumbnailUrl modelUrl')
      .lean();
    const map = new Map(parts.map((p) => [String(p._id), p]));
    return res.json({
      ok: true,
      items: rows
        .map((r) => {
          const p = map.get(String(r?.itemId || ''));
          if (!p) return null;
          return {
            itemType: 'part',
            itemId: String(p._id),
            name: p.name || '',
            type: p.type || '',
            price: Number(p.price) || 0,
            thumbnailUrl: p.thumbnailUrl || '',
            modelUrl: p.modelUrl || '',
            followedAt: r.createdAt
          };
        })
        .filter(Boolean)
    });
  }

  if (itemType === 'build') {
    const builds = await Configuration.find({ _id: { $in: ids } })
      .populate('carId', 'name thumbnailUrl')
      .select('_id name thumbnailUrl carId')
      .lean();
    const map = new Map(builds.map((b) => [String(b._id), b]));
    return res.json({
      ok: true,
      items: rows
        .map((r) => {
          const b = map.get(String(r?.itemId || ''));
          if (!b) return null;
          return {
            itemType: 'build',
            itemId: String(b._id),
            name: String(b?.name || '').trim(),
            carName: String(b?.carId?.name || '').trim(),
            thumbnailUrl: String(b?.thumbnailUrl || b?.carId?.thumbnailUrl || '').trim(),
            followedAt: r.createdAt
          };
        })
        .filter(Boolean)
    });
  }

  res.json({ ok: true, items: [] });
});

module.exports = { toggleFollow, getFollowStatus, listFollowing };
