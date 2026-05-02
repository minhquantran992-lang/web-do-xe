const fs = require('fs');

const translations = {
  admin_delete_car_confirm: { vi: 'Xóa xe này?', en: 'Delete this car?' },
  admin_delete_cars_confirm: { vi: 'Xóa {count} xe đã chọn?', en: 'Delete {count} selected cars?' },
  admin_delete_bg_confirm: { vi: 'Xóa nền này?', en: 'Delete this background?' },
  admin_delete_bgs_confirm: { vi: 'Xóa {count} nền đã chọn?', en: 'Delete {count} selected backgrounds?' },
  admin_delete_brand_confirm: { vi: 'Xóa hãng này? Hãng sẽ bị gỡ khỏi các xe đang dùng hãng này.', en: 'Delete this brand? It will be removed from cars using it.' },
  admin_delete_brands_confirm: { vi: 'Xóa {count} hãng đã chọn? Hãng sẽ bị gỡ khỏi các xe đang dùng hãng này.', en: 'Delete {count} selected brands? They will be removed from cars using them.' },
  admin_delete_part_confirm: { vi: 'Xóa phụ kiện này?', en: 'Delete this part?' },
  admin_delete_parts_confirm: { vi: 'Xóa {count} phụ kiện đã chọn?', en: 'Delete {count} selected parts?' },
  admin_login_req: { vi: 'Bạn cần đăng nhập để vào trang admin.', en: 'You must log in to access the admin page.' },
  admin_forbidden: { vi: 'Bạn không có quyền admin.', en: 'You do not have admin privileges.' },
  admin_cars_title: { vi: 'Admin • Quản lý xe', en: 'Admin • Manage Cars' },
  admin_brands_title: { vi: 'Admin • Quản lý hãng', en: 'Admin • Manage Brands' },
  admin_parts_title: { vi: 'Admin • Quản lý phụ kiện', en: 'Admin • Manage Parts' },
  admin_bgs_title: { vi: 'Admin • Quản lý phông nền', en: 'Admin • Manage Backgrounds' },
  admin_brand_name: { vi: 'Tên hãng *', en: 'Brand Name *' },
  admin_type: { vi: 'Loại', en: 'Type' },
  admin_type_req: { vi: 'Loại *', en: 'Type *' },
  admin_oto: { vi: 'Xe ô tô', en: 'Car' },
  admin_scooter: { vi: 'Xe scooter', en: 'Scooter' },
  admin_pkl: { vi: 'Xe PKL', en: 'Big Bike' },
  admin_paste_url_prompt: { vi: 'Dán URL logo vào đây:', en: 'Paste logo URL here:' },
  admin_saved_to_server: { vi: 'Đã lưu logo về server', en: 'Logo saved to server' },
  admin_save_url_error: { vi: 'Không thể tải URL này về server. Hãy thử link ảnh trực tiếp (.png/.jpg/.webp).', en: 'Cannot download this URL. Try a direct image link (.png/.jpg/.webp).' },
  admin_copied_url: { vi: 'Đã sao chép URL logo', en: 'Copied logo URL' },
  admin_copy_error: { vi: 'Không thể sao chép URL', en: 'Cannot copy URL' },
  admin_uploading_logo: { vi: 'Đang upload logo...', en: 'Uploading logo...' },
  admin_upload_error: { vi: 'Lỗi upload: ', en: 'Upload error: ' },
  admin_error: { vi: 'Lỗi: ', en: 'Error: ' },
  admin_brand: { vi: 'Hãng', en: 'Brand' },
  admin_actions: { vi: 'Thao tác', en: 'Actions' },
  admin_car_name: { vi: 'Tên xe *', en: 'Car Name *' },
  admin_uploading_model: { vi: 'Đang upload model...', en: 'Uploading model...' },
  admin_model_hint: { vi: 'Nếu không nhập model3d, hệ thống sẽ tự gán model 3D mẫu (hoặc theo thư viện tên xe nếu có).', en: 'If model3d is empty, a default 3D model will be used (or mapped by name if available).' },
  admin_edit_specs: { vi: 'Chỉnh sửa thông số xe', en: 'Edit Car Specs' },
  admin_cc: { vi: 'Dung tích (CC)', en: 'Displacement (CC)' },
  admin_specs: { vi: 'Thông số', en: 'Specs' },
  admin_power: { vi: 'Công suất (HP)', en: 'Power (HP)' },
  admin_torque: { vi: 'Mô-men (Nm)', en: 'Torque (Nm)' },
  admin_weight: { vi: 'Trọng lượng (Kg)', en: 'Weight (Kg)' },
  admin_top_speed: { vi: 'Tốc độ tối đa (Km/h)', en: 'Top Speed (Km/h)' },
  admin_fuel: { vi: 'Bình xăng (L)', en: 'Fuel (L)' },
  admin_gearbox: { vi: 'Hộp số', en: 'Gearbox' },
  admin_engine_type: { vi: 'Loại động cơ', en: 'Engine Type' },
  admin_car_name_col: { vi: 'Tên xe', en: 'Car Name' },
  admin_part_name: { vi: 'Tên phụ kiện *', en: 'Part Name *' },
  admin_bonus_specs: { vi: 'Thông số kỹ thuật cộng thêm (tuỳ chọn)', en: 'Bonus Specs (Optional)' },
  admin_bonus_power: { vi: 'Công suất (+HP)', en: 'Power (+HP)' },
  admin_bonus_torque: { vi: 'Mô-men (+Nm)', en: 'Torque (+Nm)' },
  admin_bonus_weight: { vi: 'Trọng lượng (+Kg)', en: 'Weight (+Kg)' },
  admin_name: { vi: 'Tên', en: 'Name' },
  admin_display_name: { vi: 'Tên hiển thị *', en: 'Display Name *' },
  admin_bg_image_type: { vi: 'Ảnh (showroom)', en: 'Image (showroom)' },
  admin_bg_color_type: { vi: 'Màu', en: 'Color' },
  admin_bg_image_upload: { vi: 'Ảnh nền (upload) / Image URL', en: 'Background Image (upload) / Image URL' },
  admin_uploading_image: { vi: 'Đang upload ảnh...', en: 'Uploading image...' },
  admin_sort_order: { vi: 'Thứ tự', en: 'Sort Order' },
  admin_source: { vi: 'Nguồn', en: 'Source' },
  admin_delete_selected_cars: { vi: 'Xóa xe đã chọn', en: 'Delete selected cars' },
  admin_delete_selected_brands: { vi: 'Xóa hãng đã chọn', en: 'Delete selected brands' },
  admin_paste_url_btn: { vi: 'Dán URL', en: 'Paste URL' },
  admin_save_to_server_btn: { vi: 'Lưu về server', en: 'Save to server' },
  admin_copy_btn: { vi: 'Sao chép', en: 'Copy' },
  admin_add_brand_btn: { vi: 'Thêm hãng', en: 'Add Brand' },
  admin_add_car_btn: { vi: 'Thêm xe', en: 'Add Car' },
  admin_update_car_btn: { vi: 'Cập nhật', en: 'Update' },
  admin_cancel_btn: { vi: 'Hủy', en: 'Cancel' },
  admin_model_url: { vi: 'Model 3D (upload) / URL', en: '3D Model (upload) / URL' },
  admin_thumbnail_url: { vi: 'Thumbnail (URL)', en: 'Thumbnail (URL)' },
  admin_mount_point: { vi: 'Điểm gắn (Mount point)', en: 'Mount Point' },
  admin_price: { vi: 'Giá (VND)', en: 'Price (VND)' },
  admin_add_part_btn: { vi: 'Thêm phụ kiện', en: 'Add Part' },
  admin_part_type_col: { vi: 'Loại', en: 'Type' },
  admin_key: { vi: 'Mã (Key) *', en: 'Key *' },
  admin_bg_kind: { vi: 'Loại nền', en: 'Background Kind' },
  admin_color_hex: { vi: 'Mã màu (Hex)', en: 'Color (Hex)' },
  admin_css_class: { vi: 'CSS Class (nếu có)', en: 'CSS Class (if any)' },
  admin_add_bg_btn: { vi: 'Thêm nền', en: 'Add Background' },
  admin_kind_col: { vi: 'Loại', en: 'Kind' },
  admin_image_url: { vi: 'Image URL', en: 'Image URL' }
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
console.log('i18n updated');
