use eframe::egui::{FontDefinitions, FontData, FontFamily};

pub fn setup_fonts() -> FontDefinitions {
    let mut fonts = FontDefinitions::default();

    // 1. 加载中文字体
    fonts.font_data.insert(
        "my_chinese_font".to_owned(),
        FontData::from_static(include_bytes!("../../fonts/NotoSansCJK-Regular.ttc")).into(),
    );

    // 2. 放到比例字体最前面
    fonts
        .families
        .get_mut(&FontFamily::Proportional)
        .unwrap()
        .insert(0, "my_chinese_font".to_owned());

    // 3. 放到等宽字体最前面（可选）
    fonts
        .families
        .get_mut(&FontFamily::Monospace)
        .unwrap()
        .insert(0, "my_chinese_font".to_owned());

    fonts
}
