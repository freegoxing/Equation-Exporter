#[derive(Clone, Copy, Debug, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Backend {
    Latex,
    Typst,
}

#[cfg(test)]
mod tests {
    use super::Backend;

    #[test]
    fn backend_deserializes_tauri_request_names() {
        assert!(matches!(
            serde_json::from_str::<Backend>(r#""latex""#).unwrap(),
            Backend::Latex
        ));
        assert!(matches!(
            serde_json::from_str::<Backend>(r#""typst""#).unwrap(),
            Backend::Typst
        ));
    }
}
