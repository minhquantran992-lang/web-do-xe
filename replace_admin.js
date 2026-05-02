const fs = require('fs');

const translations = {
  admin_delete_car_confirm: { vi: "Xóa xe này?" },
  admin_delete_cars_confirm: { vi: "Xóa {count} xe đã chọn?" },
  admin_delete_bg_confirm: { vi: "Xóa nền này?" },
  admin_delete_bgs_confirm: { vi: "Xóa {count} nền đã chọn?" },
  admin_delete_brand_confirm: { vi: "Xóa hãng này? Hãng sẽ bị gỡ khỏi các xe đang dùng hãng này." },
  admin_delete_brands_confirm: { vi: "Xóa {count} hãng đã chọn? Hãng sẽ bị gỡ khỏi các xe đang dùng hãng này." },
  admin_delete_part_confirm: { vi: "Xóa phụ kiện này?" },
  admin_delete_parts_confirm: { vi: "Xóa {count} phụ kiện đã chọn?" },
  admin_login_req: { vi: "Bạn cần đăng nhập để vào trang admin." },
  admin_forbidden: { vi: "Bạn không có quyền admin." },
  admin_cars_title: { vi: "Admin • Quản lý xe" },
  admin_brands_title: { vi: "Admin • Quản lý hãng" },
  admin_parts_title: { vi: "Admin • Quản lý phụ kiện" },
  admin_bgs_title: { vi: "Admin • Quản lý phông nền" },
  admin_brand_name: { vi: "Tên hãng *" },
  admin_type_req: { vi: "Loại *" },
  admin_type: { vi: "Loại" },
  admin_oto: { vi: "Xe ô tô" },
  admin_scooter: { vi: "Xe scooter" },
  admin_pkl: { vi: "Xe PKL" },
  admin_paste_url_prompt: { vi: "Dán URL logo vào đây:" },
  admin_saved_to_server: { vi: "Đã lưu logo về server" },
  admin_save_url_error: { vi: "Không thể tải URL này về server. Hãy thử link ảnh trực tiếp (.png/.jpg/.webp)." },
  admin_copied_url: { vi: "Đã sao chép URL logo" },
  admin_copy_error: { vi: "Không thể sao chép URL" },
  admin_uploading_logo: { vi: "Đang upload logo..." },
  admin_upload_error: { vi: "Lỗi upload: " },
  admin_error: { vi: "Lỗi: " },
  admin_brand: { vi: "Hãng" },
  admin_actions: { vi: "Thao tác" },
  admin_car_name: { vi: "Tên xe *" },
  admin_uploading_model: { vi: "Đang upload model..." },
  admin_model_hint: { vi: "Nếu không nhập model3d, hệ thống sẽ tự gán model 3D mẫu (hoặc theo thư viện tên xe nếu có)." },
  admin_edit_specs: { vi: "Chỉnh sửa thông số xe" },
  admin_cc: { vi: "Dung tích (CC)" },
  admin_specs: { vi: "Thông số" },
  admin_power: { vi: "Công suất (HP)" },
  admin_torque: { vi: "Mô-men (Nm)" },
  admin_weight: { vi: "Trọng lượng (Kg)" },
  admin_top_speed: { vi: "Tốc độ tối đa (Km/h)" },
  admin_fuel: { vi: "Bình xăng (L)" },
  admin_gearbox: { vi: "Hộp số" },
  admin_engine_type: { vi: "Loại động cơ" },
  admin_car_name_col: { vi: "Tên xe" },
  admin_part_name: { vi: "Tên phụ kiện *" },
  admin_bonus_specs: { vi: "Thông số kỹ thuật cộng thêm (tuỳ chọn)" },
  admin_bonus_power: { vi: "Công suất (+HP)" },
  admin_bonus_torque: { vi: "Mô-men (+Nm)" },
  admin_bonus_weight: { vi: "Trọng lượng (+Kg)" },
  admin_name: { vi: "Tên" },
  admin_display_name: { vi: "Tên hiển thị *" },
  admin_bg_image_type: { vi: "Ảnh (showroom)" },
  admin_bg_color_type: { vi: "Màu" },
  admin_bg_image_upload: { vi: "Ảnh nền (upload) / Image URL" },
  admin_uploading_image: { vi: "Đang upload ảnh..." },
  admin_sort_order: { vi: "Thứ tự" },
  admin_source: { vi: "Nguồn" },
  admin_delete_selected_cars: { vi: "Xóa xe đã chọn" },
  admin_delete_selected_brands: { vi: "Xóa hãng đã chọn" },
  admin_paste_url_btn: { vi: "Dán URL" },
  admin_save_to_server_btn: { vi: "Lưu về server" },
  admin_copy_btn: { vi: "Sao chép" },
  admin_add_brand_btn: { vi: "Thêm hãng" },
  admin_add_car_btn: { vi: "Thêm xe" },
  admin_update_car_btn: { vi: "Cập nhật" },
  admin_cancel_btn: { vi: "Hủy" },
  admin_model_url: { vi: "Model 3D (upload) / URL" },
  admin_thumbnail_url: { vi: "Thumbnail (URL)" },
  admin_mount_point: { vi: "Điểm gắn (Mount point)" },
  admin_price: { vi: "Giá (VND)" },
  admin_add_part_btn: { vi: "Thêm phụ kiện" },
  admin_part_type_col: { vi: "Loại" },
  admin_key: { vi: "Mã (Key) *" },
  admin_bg_kind: { vi: "Loại nền" },
  admin_color_hex: { vi: "Mã màu (Hex)" },
  admin_css_class: { vi: "CSS Class (nếu có)" },
  admin_add_bg_btn: { vi: "Thêm nền" },
  admin_kind_col: { vi: "Loại" },
  admin_image_url: { vi: "Image URL" },
  admin_logo_url: { vi: "Logo URL" }
};

let content = fs.readFileSync('frontend/src/pages/AdminCars.jsx', 'utf8');

if (!content.includes('useI18n')) {
  content = content.replace("import { useState, useEffect } from 'react';", "import { useState, useEffect } from 'react';\nimport { useI18n } from '../services/i18n';");
  content = content.replace("export default function AdminCars() {", "export default function AdminCars() {\n  const { t } = useI18n();");
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

for (const [key, value] of Object.entries(translations)) {
  const viStr = value.vi;
  
  if (viStr.includes('${')) {
    // Template literal replacement
    const safeRegex = escapeRegExp(viStr);
    const regex = new RegExp(`\`${safeRegex}\``, 'g');
    content = content.replace(regex, `t('${key}').replace('{count}', ${viStr.match(/\$\{([^}]+)\}/)[1]})`);
  } else {
    // Exact string replacement
    const safeRegex = escapeRegExp(viStr);
    const regexTag = new RegExp(`>\\s*${safeRegex}\\s*<`, 'g');
    content = content.replace(regexTag, `>{t('${key}')}<`);
    
    const regexSingle = new RegExp(`'${safeRegex}'`, 'g');
    content = content.replace(regexSingle, `t('${key}')`);
  }
}

// Special case fixes for concatenated strings
content = content.replace(/'Lỗi upload: ' \+ brandLogoUploadError/g, "`{t('admin_upload_error')} ${brandLogoUploadError}`");
content = content.replace(/'Lỗi upload: ' \+ carUploadError/g, "`{t('admin_upload_error')} ${carUploadError}`");
content = content.replace(/'Lỗi upload: ' \+ partUploadError/g, "`{t('admin_upload_error')} ${partUploadError}`");
content = content.replace(/'Lỗi upload: ' \+ bgUploadError/g, "`{t('admin_upload_error')} ${bgUploadError}`");

content = content.replace(/>Lỗi upload: \{([^}]+)\}</g, ">{t('admin_upload_error')}{$1}<");
content = content.replace(/>Lỗi: \{([^}]+)\}</g, ">{t('admin_error')}{$1}<");

fs.writeFileSync('frontend/src/pages/AdminCars.jsx', content);
console.log('AdminCars updated');
