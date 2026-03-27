const fs = require('fs');

const translations = {
  admin_delete_btn: { vi: 'Xóa', en: 'Delete' },
  admin_no_brands: { vi: 'Chưa có hãng.', en: 'No brands.' },
  admin_car: { vi: 'Ô tô', en: 'Car' },
  admin_model_placeholder: { vi: '(để trống sẽ tự chọn model 3D mẫu)', en: '(leave empty to use default 3D model)' },
  admin_loading: { vi: 'Đang tải...', en: 'Loading...' },
  admin_close: { vi: 'Đóng', en: 'Close' },
  admin_model_url_placeholder: { vi: '/uploads/models/xxx.glb hoặc https://...', en: '/uploads/models/xxx.glb or https://...' },
  admin_update_info: { vi: 'Cập nhật thông tin', en: 'Update info' },
  admin_edit_btn: { vi: 'Sửa', en: 'Edit' },
  admin_no_cars: { vi: 'Chưa có xe.', en: 'No cars.' },
  admin_delete_selected_parts: { vi: 'Xóa phụ kiện đã chọn', en: 'Delete selected parts' },
  admin_no_parts: { vi: 'Chưa có phụ kiện.', en: 'No parts.' },
  admin_delete_selected_bgs: { vi: 'Xóa nền đã chọn', en: 'Delete selected backgrounds' },
  admin_bg_url_placeholder: { vi: '/uploads/backgrounds/showroom.jpg hoặc https://...', en: '/uploads/backgrounds/showroom.jpg or https://...' },
  admin_no_bgs: { vi: 'Chưa có nền.', en: 'No backgrounds.' }
};

let i18nContent = fs.readFileSync('frontend/src/services/i18n.jsx', 'utf8');

// Insert english keys
const enIndex = i18nContent.indexOf("lang_en: 'EN',");
const enInsertPoint = enIndex + "lang_en: 'EN',".length;
let enStrings = '\n' + Object.entries(translations).map(([k, v]) => `    ${k}: \`${v.en.replace(/`/g, "\\`")}\`,`).join('\n');
i18nContent = i18nContent.slice(0, enInsertPoint) + enStrings + i18nContent.slice(enInsertPoint);

// Insert vietnamese keys
const viBlockStart = i18nContent.indexOf('vi: {');
const viIndex = i18nContent.indexOf("lang_en: 'EN',", viBlockStart);
const viInsertPoint = viIndex + "lang_en: 'EN',".length;
let viStrings = '\n' + Object.entries(translations).map(([k, v]) => `    ${k}: \`${v.vi.replace(/`/g, "\\`")}\`,`).join('\n');
i18nContent = i18nContent.slice(0, viInsertPoint) + viStrings + i18nContent.slice(viInsertPoint);

fs.writeFileSync('frontend/src/services/i18n.jsx', i18nContent);

let adminContent = fs.readFileSync('frontend/src/pages/AdminCars.jsx', 'utf8');

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

for (const [key, value] of Object.entries(translations)) {
  const viStr = value.vi;
  
  // placeholder replacement
  const safeRegex = escapeRegExp(viStr);
  const regexPlaceholder = new RegExp(`placeholder="${safeRegex}"`, 'g');
  adminContent = adminContent.replace(regexPlaceholder, `placeholder={t('${key}')}`);
  
  // > < replacement
  const regexTag = new RegExp(`>\\s*${safeRegex}\\s*<`, 'g');
  adminContent = adminContent.replace(regexTag, `>{t('${key}')}<`);
  
  // ' ' replacement
  const regexSingle = new RegExp(`'${safeRegex}'`, 'g');
  adminContent = adminContent.replace(regexSingle, `t('${key}')`);
}

// Special case for "Đăng nhập" since it maps to 'nav_login'
adminContent = adminContent.replace(/>\s*Đăng nhập\s*</g, `>{t('nav_login')}<`);

fs.writeFileSync('frontend/src/pages/AdminCars.jsx', adminContent);

console.log('Done!');
