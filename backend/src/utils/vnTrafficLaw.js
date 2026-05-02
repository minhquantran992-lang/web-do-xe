const removeDiacritics = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd');

const normalize = (value) =>
  removeDiacritics(String(value || '').toLowerCase())
    .replace(/[\s\-_./]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim();

const pickType = ({ partType, partName }) => {
  const t = normalize(partType);
  const n = normalize(partName);
  const s = `${t} ${n}`.trim();

  if (/\bexhaust\b|po\b|p[oô]\b|ong xa|po do|full system|slip on|pô/.test(s)) return 'exhaust';
  if (/\blighting\b|den\b|đèn|xi nhan|xinhan|led|bi led|bi led|pha|cos|pha cos|dem gay/.test(s)) return 'lighting';
  if (/\bwheels\b|mam\b|mâm|rim|lazang|vanh|wheel/.test(s)) return 'wheels';
  if (/\btire\b|lop\b|lốp|vo xe|tire/.test(s)) return 'tire';
  if (/\bbrake\b|phanh|heo|dia|đĩa|day dau|day dau phanh|brake/.test(s)) return 'brake';
  if (/\bsuspension\b|phuoc|phuộc|monoshock|shock|ty phuoc|lo xo/.test(s)) return 'suspension';
  if (/\bhandlebar\b|ghi dong|ghiđong|clip on|clipon|tay lai|tay lái/.test(s)) return 'handlebar';
  if (/\b(topbox|top box|thung|thung sau|thung giua|rear box|box|pannier|side box|baga|rack|gia do|givi|shad|kappa)\b/.test(s)) return 'topbox';
  if (/\bbodykit\b|dan ao|dàn áo|op po|ốp pô|de bieu|dè biển|pát biển|pat bien|tail tidy|fullset ao/.test(s)) return 'bodykit';
  if (/\bseat\b|yen\b|yên|dem|đệm/.test(s)) return 'seat';
  if (/\bclutch\b|noi\b|nồi|bo noi|bộ nồi|la noi|lá nồi/.test(s)) return 'clutch';
  return partType ? String(partType).trim().toLowerCase() : '';
};

const buildResult = ({ status, reason, fine, alternatives }) => {
  const label_vi = status === 'legal' ? 'Hợp pháp' : status === 'illegal' ? 'Vi phạm luật' : 'Có nguy cơ bị phạt';
  return {
    status,
    label_vi,
    reason: String(reason || '').trim(),
    fine: String(fine || '').trim(),
    alternatives: Array.isArray(alternatives) ? alternatives.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 3) : []
  };
};

const evaluatePartLegality = ({ motorcycle, partName, partType }) => {
  const bike = String(motorcycle || '').trim();
  const name = String(partName || '').trim();
  const type = pickType({ partType, partName });
  const s = normalize(`${name} ${type}`);

  const basisCore = 'Căn cứ phổ biến: Nghị định 100/2019/NĐ-CP (sửa đổi bởi Nghị định 123/2021/NĐ-CP).';
  const fineOwnerStructure =
    '800.000–2.000.000đ (chủ xe mô tô tự ý thay đổi khung/máy/hình dáng/kích thước/đặc tính) — Điều 30 khoản 5 điểm c.';
  const fineDriverNoiseEquip =
    '100.000–200.000đ (điều khiển xe không có/không bảo đảm bộ phận giảm thanh, giảm khói; không bảo đảm quy chuẩn môi trường về khí thải, tiếng ồn) — Điều 17 khoản 1 điểm đ.';
  const fineDriverRevInCity =
    '400.000–600.000đ (rú ga/bấm còi liên tục trong đô thị, khu đông dân cư) — Điều 6 khoản 3 điểm c.';
  const fineDriverLighting =
    '100.000–200.000đ (đèn chiếu sáng không đúng tiêu chuẩn thiết kế / lắp đèn chiếu sáng về phía sau xe) — Điều 17 khoản 1 điểm e, h.';
  const fineDriverPlate =
    '100.000–200.000đ (gắn/che/bẻ cong biển số, làm thay đổi chữ/số/màu chữ số/nền biển) — Điều 17 khoản 1 điểm b.';

  if (!name && !String(partType || '').trim()) {
    return buildResult({
      status: 'warning',
      reason:
        `Bạn chưa cung cấp rõ tên món độ và loại phụ kiện nên chưa thể kết luận chính xác. Với xe ${bike || 'máy'} ở Việt Nam, các món độ dễ bị kiểm tra gồm: pô/tiếng ồn, đèn/xi-nhan, biển số/pát biển, và thay đổi kết cấu.`,
      fine: `${basisCore} Tuỳ lỗi cụ thể, mức phạt thường gặp từ 100.000đ đến 2.000.000đ và có thể bị yêu cầu khôi phục về tình trạng “zin”.`,
      alternatives: ['Dùng phụ tùng zin (OEM) hoặc thay thế tương đương zin', 'Giữ đúng màu/độ sáng đèn, không gây chói', 'Tránh thay đổi pát biển/độ góc biển số']
    });
  }

  if (type === 'bodykit') {
    if (/(pat bien|pát biển|de bien|dè biển|tail tidy|cat duoi|cắt đuôi|che bien|che biển|gap bien|gập biển)/i.test(String(partName || ''))) {
      return buildResult({
        status: 'illegal',
        reason:
          `Món ${name} có dấu hiệu can thiệp khu vực biển số/đuôi xe. Các kiểu pát biển gập, che biển, thay đổi vị trí/góc biển số rất dễ bị xử phạt vì không đúng quy định và có thể bị xem là thay đổi kết cấu.`,
        fine: `${basisCore} Có thể bị xử phạt theo lỗi biển số và/hoặc lỗi thay đổi kết cấu: ${fineDriverPlate} Đồng thời ${fineOwnerStructure}`,
        alternatives: ['Dùng pát biển zin hoặc pát đúng vị trí, góc gần zin và vẫn có đèn biển', 'Giữ biển số đúng kích thước, không che chắn', 'Nếu muốn gọn: chỉ thay ốp trang trí, không đụng biển số']
      });
    }
    return buildResult({
      status: 'warning',
      reason:
        `Các món thuộc nhóm dàn áo/ốp/pát (${name}) có thể bị coi là thay đổi hình dáng xe nếu thay đổi nhiều so với thiết kế ban đầu. Nếu lắp “gọn – đúng vị trí – không ảnh hưởng biển số/đèn/xi-nhan” thì rủi ro thấp hơn.`,
      fine: `${basisCore} Trường hợp bị quy vào thay đổi kết cấu: ${fineOwnerStructure}`,
      alternatives: ['Ưu tiên đồ zin hoặc ốp trang trí nhẹ, không thay đổi kết cấu', 'Tránh pát biển gập/che biển', 'Giữ đủ gương/đèn/xi-nhan đúng tiêu chuẩn']
    });
  }

  if (type === 'lighting') {
    if (/(strobo|strobe|nhap nhay|nhấp nháy|police|uu tien|ưu tiên|red|blue|do xanh|đỏ xanh|7 mau|7mau|rgb|laser)/.test(s)) {
      return buildResult({
        status: 'illegal',
        reason:
          `Món ${name} thuộc nhóm đèn và có dấu hiệu “đèn nhấp nháy/đèn ưu tiên/màu đỏ-xanh/RGB”. Đây là nhóm rất dễ bị xử phạt vì không đúng thiết kế/tiêu chuẩn và gây chói, ảnh hưởng an toàn giao thông.`,
        fine: `${basisCore} ${fineDriverLighting}`,
        alternatives: ['Dùng đèn/bóng đúng màu trắng hoặc vàng, ánh sáng ổn định', 'Chỉnh cos/pha đúng chùm sáng, không gây chói', 'Dùng xi-nhan/đèn hậu chuẩn E-mark/SAE (nếu có) hoặc zin']
      });
    }
    return buildResult({
      status: 'warning',
      reason:
        `Độ đèn (${name}) thường bị kiểm tra nếu ánh sáng quá chói, sai màu, hoặc lắp bi/LED không có chùm cắt. Nếu chỉ nâng sáng nhưng vẫn đúng màu, có cut-off và chỉnh góc chuẩn thì rủi ro thấp hơn.`,
      fine: `${basisCore} ${fineDriverLighting}`,
      alternatives: ['Dùng bóng/đèn đúng màu và có cut-off rõ (bi LED chuẩn)', 'Chỉnh đèn tại tường: không hắt cao gây chói', 'Giữ xi-nhan đúng màu và vị trí rõ ràng']
    });
  }

  if (type === 'exhaust') {
    if (/(straight|thang|thẳng|race|dua|đua|no db|khong db|without db|decat|cat delete|catdelete|open pipe|po thoang|pô thoáng)/.test(s)) {
      return buildResult({
        status: 'illegal',
        reason:
          `Món ${name} có dấu hiệu là pô/ống xả kiểu “race/thoáng/không DB-killer/decat” nên rất dễ vượt ngưỡng tiếng ồn/khí thải và bị coi là thay đổi đặc tính phương tiện. Trường hợp này rủi ro bị xử phạt cao.`,
        fine: `${basisCore} Có thể bị xử phạt theo lỗi phương tiện/tiếng ồn và/hoặc lỗi chủ xe thay đổi đặc tính: ${fineDriverNoiseEquip} Đồng thời ${fineOwnerStructure} Nếu có hành vi rú ga trong đô thị/khu đông dân cư: ${fineDriverRevInCity}`,
        alternatives: ['Giữ pô zin hoặc pô có DB-killer và không tháo tiêu/catalyst', 'Chọn slip-on êm, không nổ/khạc lớn', 'Ưu tiên nâng cấp phanh/lốp/phuộc trước để an toàn']
      });
    }
    return buildResult({
      status: 'warning',
      reason:
        `Pô/ống xả (${name}) là hạng mục hay bị kiểm tra do tiếng ồn. Nếu dùng pô có DB-killer, không “nổ lớn”, giữ cổ/tiêu chuẩn gần zin thì rủi ro thấp hơn nhưng vẫn có nguy cơ tuỳ khu vực và cách chạy.`,
      fine: `${basisCore} Thường bị xử lý theo lỗi tiếng ồn/thiếu bộ phận giảm thanh: ${fineDriverNoiseEquip} Nếu bị coi là thay đổi đặc tính xe: ${fineOwnerStructure}`,
      alternatives: ['Dùng pô zin', 'Dùng pô có DB-killer, âm lượng vừa phải', 'Tăng trải nghiệm bằng lốp/phanh thay vì pô']
    });
  }

  if (type === 'wheels' || type === 'tire') {
    return buildResult({
      status: 'warning',
      reason:
        `Thay mâm/lốp (${name}) thường không bị “cấm tuyệt đối”, nhưng sẽ có nguy cơ bị hỏi nếu đổi size quá khác zin, cạ vè, làm xe thiếu an toàn hoặc bị coi là thay đổi kết cấu. An toàn và đúng thông số là yếu tố quyết định.`,
      fine: `${basisCore} Nếu bị quy vào thay đổi kết cấu/đặc tính: ${fineOwnerStructure}`,
      alternatives: ['Giữ đúng size lốp/mâm theo thông số zin hoặc tương đương', 'Chọn lốp có tải trọng/tốc độ phù hợp và lắp đúng kỹ thuật', 'Tránh canh bánh quá sát gây cạ và mất ổn định']
    });
  }

  if (type === 'brake' || type === 'suspension' || type === 'clutch') {
    return buildResult({
      status: 'warning',
      reason:
        `Món ${name} thuộc nhóm nâng cấp an toàn/hiệu năng (${type}). Thường rủi ro thấp hơn so với pô/đèn, nhưng vẫn có thể bị xem xét nếu thay đổi kết cấu (độ gắp/độ phuộc quá khác) hoặc lắp đặt không an toàn.`,
      fine: `${basisCore} Nếu bị quy vào thay đổi kết cấu/đặc tính: ${fineOwnerStructure}`,
      alternatives: ['Dùng phụ tùng chất lượng, lắp đúng kỹ thuật và có bảo hành', 'Giữ thông số gần zin, tránh hạ/gôn quá mức', 'Kiểm tra an toàn sau lắp: phanh, cạ, độ rơ, cân bằng']
    });
  }

  if (type === 'seat') {
    return buildResult({
      status: 'legal',
      reason: `Các hạng mục yên/đệm (${name}) thường hợp pháp nếu không làm ảnh hưởng kết cấu, không che biển số/đèn và không gây mất an toàn khi vận hành.`,
      fine: 'Không đáng kể nếu chỉ bọc/đổi yên đúng kích thước và không ảnh hưởng an toàn.',
      alternatives: ['Bọc yên chống trượt/êm (giữ form zin)', 'Thay mút yên chất lượng tốt, không thay đổi quá cao', 'Dùng ốp yên trang trí đúng kích thước']
    });
  }

  if (type === 'topbox') {
    return buildResult({
      status: 'legal',
      reason:
        `Thùng/baga (${name}) thường hợp pháp nếu lắp đúng pát/baga chắc chắn, không che biển số/đèn và không làm thay đổi kết cấu xe. Rủi ro chủ yếu là che khuất biển số/đèn biển hoặc lắp thiếu an toàn.`,
      fine: `${basisCore} Nếu bị che/đổi vị trí/gập biển số: ${fineDriverPlate} Trường hợp bị quy là thay đổi kết cấu: ${fineOwnerStructure}`,
      alternatives: [
        'Lắp đúng baga/pát chuyên dụng, siết đủ lực và kiểm tra rung/lỏng sau vài ngày sử dụng',
        'Đảm bảo biển số + đèn biển số vẫn rõ, không bị che khuất từ phía sau',
        'Tránh thùng quá rộng/nhô dài gây vướng, mất an toàn hoặc dễ bị hỏi'
      ]
    });
  }

  return buildResult({
    status: 'warning',
    reason:
      `Món ${name} (${type || 'phụ kiện'}) chưa đủ thông tin để kết luận chắc chắn. Ở Việt Nam, rủi ro xử phạt phụ thuộc: có thay đổi kết cấu/hình dáng không, tiếng ồn, đèn có gây chói/sai màu, và độ an toàn khi vận hành.`,
    fine: `${basisCore} Tuỳ lỗi cụ thể, mức phạt thường gặp từ 100.000đ đến 2.000.000đ.`,
    alternatives: ['Ưu tiên đồ zin hoặc tương đương zin', 'Tránh can thiệp biển số/đèn và các thay đổi gây mất an toàn', 'Lắp đặt chắc chắn, không tạo tiếng ồn bất thường khi chạy']
  });
};

module.exports = { evaluatePartLegality };
