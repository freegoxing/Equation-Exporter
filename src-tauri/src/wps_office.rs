use std::io::{Cursor, Write};

use quick_xml::{
    XmlVersion,
    events::{BytesStart, Event},
    name::ResolveResult,
    reader::NsReader,
};
use zip::{CompressionMethod, ZipWriter, write::SimpleFileOptions};

const INVALID_OMML: &str = "无效的 OMML 公式";
const MATH_NAMESPACE: &str = "http://schemas.openxmlformats.org/officeDocument/2006/math";

/// Builds a minimal in-memory DOCX package containing one native OMML formula.
pub fn document_from_omml(omml: &str) -> Result<Vec<u8>, String> {
    if !is_valid_omml(omml) {
        return Err(INVALID_OMML.to_owned());
    }

    let document = format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p>{omml}</w:p><w:sectPr/></w:body></w:document>"#
    );

    let mut archive = ZipWriter::new(Cursor::new(Vec::new()));
    write_part(
        &mut archive,
        "[Content_Types].xml",
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>"#,
    )?;
    write_part(
        &mut archive,
        "_rels/.rels",
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>"#,
    )?;
    write_part(&mut archive, "word/document.xml", &document)?;

    archive
        .finish()
        .map(|cursor| cursor.into_inner())
        .map_err(|error| error.to_string())
}

fn is_valid_omml(omml: &str) -> bool {
    let mut reader = NsReader::from_str(omml);
    reader.config_mut().enable_all_checks(true);
    reader.config_mut().check_comments = true;

    let mut depth = 0usize;
    let mut saw_root = false;
    let mut closed_root = false;

    loop {
        let (namespace, event) = match reader.read_resolved_event() {
            Ok(event) => event,
            Err(_) => return false,
        };
        let namespace = match namespace {
            ResolveResult::Unbound => Some(Vec::new()),
            ResolveResult::Bound(namespace) => Some(namespace.as_ref().to_vec()),
            ResolveResult::Unknown(_) => None,
        };

        match event {
            Event::Start(start) => {
                if namespace.is_none()
                    || !is_valid_qualified_name(start.name().as_ref())
                    || !attributes_are_valid(&reader, &start)
                {
                    return false;
                }
                if depth == 0 {
                    if saw_root
                        || closed_root
                        || !is_math_root(namespace.as_deref(), start.local_name().as_ref())
                    {
                        return false;
                    }
                    saw_root = true;
                }
                depth += 1;
            }
            Event::Empty(empty) => {
                if namespace.is_none()
                    || !is_valid_qualified_name(empty.name().as_ref())
                    || !attributes_are_valid(&reader, &empty)
                {
                    return false;
                }
                if depth == 0 {
                    if saw_root
                        || closed_root
                        || !is_math_root(namespace.as_deref(), empty.local_name().as_ref())
                    {
                        return false;
                    }
                    saw_root = true;
                    closed_root = true;
                }
            }
            Event::End(end) => {
                if namespace.is_none()
                    || depth == 0
                    || !is_valid_qualified_name(end.name().as_ref())
                {
                    return false;
                }
                depth -= 1;
                if depth == 0 {
                    closed_root = true;
                }
            }
            Event::Text(text) => {
                let text_bytes: &[u8] = text.as_ref();
                if !is_valid_xml_characters(text_bytes)
                    || text_bytes
                        .windows(3)
                        .any(|window| window == b"]]>".as_slice())
                {
                    return false;
                }
                if depth == 0 && !is_xml_whitespace(text_bytes) {
                    return false;
                }
            }
            Event::CData(cdata) => {
                if depth == 0 || !is_valid_xml_characters(cdata.as_ref()) {
                    return false;
                }
            }
            Event::GeneralRef(reference) => {
                if depth == 0 || !is_valid_entity_reference(reference.as_ref()) {
                    return false;
                }
            }
            Event::Comment(_) => return false,
            Event::Decl(_) | Event::PI(_) | Event::DocType(_) => return false,
            Event::Eof => return saw_root && closed_root && depth == 0,
        }
    }
}

fn is_math_root(namespace: Option<&[u8]>, local_name: &[u8]) -> bool {
    namespace == Some(MATH_NAMESPACE.as_bytes()) && local_name == b"oMath"
}

fn attributes_are_valid(reader: &NsReader<&[u8]>, start: &BytesStart<'_>) -> bool {
    let mut expanded_names: Vec<(Vec<u8>, Vec<u8>)> = Vec::new();

    for attribute in start.attributes() {
        let Ok(attribute) = attribute else {
            return false;
        };
        if !is_valid_qualified_name(attribute.key.as_ref()) {
            return false;
        }
        let Ok(value) =
            attribute.decoded_and_normalized_value(XmlVersion::Implicit1_0, start.decoder())
        else {
            return false;
        };
        if !is_valid_xml_characters(value.as_bytes()) {
            return false;
        }

        if attribute.key.as_namespace_binding().is_some() {
            if attribute.key.as_ref().starts_with(b"xmlns:") && value.is_empty() {
                return false;
            }
            continue;
        }

        let (namespace, local_name) = reader.resolver().resolve_attribute(attribute.key);
        let namespace = match namespace {
            ResolveResult::Unbound => Vec::new(),
            ResolveResult::Bound(namespace) => namespace.as_ref().to_vec(),
            ResolveResult::Unknown(_) => return false,
        };
        let expanded_name = (namespace, local_name.as_ref().to_vec());
        if expanded_names
            .iter()
            .any(|(seen_namespace, seen_local_name)| {
                seen_namespace == &expanded_name.0 && seen_local_name == &expanded_name.1
            })
        {
            return false;
        }
        expanded_names.push(expanded_name);
    }

    true
}

fn is_valid_qualified_name(name: &[u8]) -> bool {
    let mut parts = name.split(|byte| *byte == b':');
    let first = parts.next().unwrap_or_default();
    let second = parts.next();

    if parts.next().is_some() {
        return false;
    }

    match second {
        Some(local_name) => is_valid_xml_name_part(first) && is_valid_xml_name_part(local_name),
        None => is_valid_xml_name_part(first),
    }
}

fn is_valid_xml_name_part(name: &[u8]) -> bool {
    let Some((&first, rest)) = name.split_first() else {
        return false;
    };

    is_ascii_xml_name_start(first) && rest.iter().copied().all(is_ascii_xml_name_char)
}

fn is_ascii_xml_name_start(byte: u8) -> bool {
    matches!(byte, b'A'..=b'Z' | b'a'..=b'z' | b'_')
}

fn is_ascii_xml_name_char(byte: u8) -> bool {
    is_ascii_xml_name_start(byte) || matches!(byte, b'0'..=b'9' | b'-' | b'.')
}

fn is_valid_entity_reference(reference: &[u8]) -> bool {
    match reference {
        b"lt" | b"gt" | b"amp" | b"apos" | b"quot" => true,
        reference if reference.starts_with(b"#") => {
            let number = if reference.starts_with(b"#x") || reference.starts_with(b"#X") {
                std::str::from_utf8(&reference[2..])
                    .ok()
                    .and_then(|number| u32::from_str_radix(number, 16).ok())
            } else if reference[1..].iter().all(u8::is_ascii_digit) {
                std::str::from_utf8(&reference[1..])
                    .ok()
                    .and_then(|number| number.parse::<u32>().ok())
            } else {
                None
            };
            number
                .and_then(char::from_u32)
                .is_some_and(is_valid_xml_character)
        }
        _ => false,
    }
}

fn is_valid_xml_characters(value: &[u8]) -> bool {
    std::str::from_utf8(value)
        .map(|value| value.chars().all(is_valid_xml_character))
        .unwrap_or(false)
}

fn is_valid_xml_character(character: char) -> bool {
    matches!(character, '\u{9}' | '\u{A}' | '\u{D}')
        || ('\u{20}'..='\u{D7FF}').contains(&character)
        || ('\u{E000}'..='\u{FFFD}').contains(&character)
        || ('\u{10000}'..='\u{10FFFF}').contains(&character)
}

fn is_xml_whitespace(value: &[u8]) -> bool {
    value
        .iter()
        .all(|byte| matches!(*byte, b' ' | b'\t' | b'\r' | b'\n'))
}

fn write_part(
    archive: &mut ZipWriter<Cursor<Vec<u8>>>,
    name: &str,
    contents: &str,
) -> Result<(), String> {
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    archive
        .start_file(name, options)
        .map_err(|error| error.to_string())?;
    archive
        .write_all(contents.as_bytes())
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::document_from_omml;
    use std::io::{Cursor, Read};
    use zip::ZipArchive;

    fn valid_omml() -> &'static str {
        r#"<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><m:r><m:t>x</m:t></m:r></m:oMath>"#
    }

    #[test]
    fn stores_a_native_office_math_element_in_word_document_xml() {
        let bytes = document_from_omml(
            r#"<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><m:r><m:t>x</m:t></m:r></m:oMath>"#,
        )
        .unwrap();
        let mut archive = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut document = String::new();
        archive
            .by_name("word/document.xml")
            .unwrap()
            .read_to_string(&mut document)
            .unwrap();
        assert!(document.contains("<m:oMath"));
        assert!(document.contains("<m:t>x</m:t>"));
        assert!(document.contains("<w:p><m:oMath"));
        assert!(!document.contains("<w:p><w:r><m:oMath"));
    }

    #[test]
    fn accepts_an_office_math_root_with_a_different_prefix() {
        let bytes = document_from_omml(
            r#"<math:oMath xmlns:math="http://schemas.openxmlformats.org/officeDocument/2006/math"><math:r><math:t>x</math:t></math:r></math:oMath>"#,
        );
        assert!(bytes.is_ok());
    }

    #[test]
    fn rejects_malformed_omml() {
        assert!(document_from_omml(
            r#"<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><m:r></m:oMath>"#,
        )
        .is_err());
    }

    #[test]
    fn rejects_cdata_end_sequence_in_character_data() {
        assert!(document_from_omml(
            r#"<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><m:t>bad]]></m:t></m:oMath>"#,
        )
        .is_err());
    }

    #[test]
    fn rejects_omml_that_is_not_one_office_math_root() {
        assert!(document_from_omml("<m:r/>").is_err());
    }

    #[test]
    fn rejects_spoofed_math_namespace() {
        assert!(document_from_omml(
            r#"<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math-spoof"><m:r/></m:oMath>"#,
        )
        .is_err());
    }

    #[test]
    fn rejects_xml_declaration_before_omml_root() {
        assert!(document_from_omml(
            r#"<?xml version="1.0"?><m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"/>"#,
        )
        .is_err());
    }

    #[test]
    fn rejects_processing_instruction_before_omml_root() {
        assert!(document_from_omml(
            r#"<?instruction data?><m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"/>"#,
        )
        .is_err());
    }

    #[test]
    fn rejects_processing_instruction_inside_omml_fragment() {
        assert!(document_from_omml(
            r#"<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><?instruction data?></m:oMath>"#,
        )
        .is_err());
    }

    #[test]
    fn rejects_xml_processing_instruction_target_case_insensitively() {
        assert!(document_from_omml(
            r#"<?XML version="1.0"?><m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"/>"#,
        )
        .is_err());
    }

    #[test]
    fn rejects_xml_prefix_bound_to_a_different_namespace() {
        assert!(document_from_omml(
            r#"<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:xml="urn:not-xml"/>"#,
        )
        .is_err());
    }

    #[test]
    fn rejects_non_xml_prefix_bound_to_the_xml_namespace() {
        assert!(document_from_omml(
            r#"<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:notxml="http://www.w3.org/XML/1998/namespace"/>"#,
        )
        .is_err());
    }

    #[test]
    fn rejects_prefix_bound_to_the_xmlns_namespace() {
        assert!(document_from_omml(
            r#"<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:notxml="http://www.w3.org/2000/xmlns/"/>"#,
        )
        .is_err());
    }

    #[test]
    fn rejects_multiple_colons_in_element_names() {
        assert!(document_from_omml(
            r#"<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><m:r:bad/></m:oMath>"#,
        )
        .is_err());
    }

    #[test]
    fn rejects_multiple_colons_in_attribute_names() {
        assert!(document_from_omml(
            r#"<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" m:bad:name="x"/>"#,
        )
        .is_err());
    }

    #[test]
    fn rejects_an_attribute_name_containing_ampersand() {
        assert!(document_from_omml(
            r#"<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" bad&name="x"/>"#,
        )
        .is_err());
    }

    #[test]
    fn rejects_element_names_with_a_digit_prefix() {
        assert!(document_from_omml(
            r#"<1:oMath xmlns:1="http://schemas.openxmlformats.org/officeDocument/2006/math"/>"#,
        )
        .is_err());
    }

    #[test]
    fn rejects_comments_before_the_omml_root() {
        assert!(document_from_omml(
            r#"<!--before--><m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"/>"#,
        )
        .is_err());
    }

    #[test]
    fn rejects_comments_inside_the_omml_root() {
        assert!(document_from_omml(
            r#"<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><!--inside--></m:oMath>"#,
        )
        .is_err());
    }

    #[test]
    fn rejects_comments_after_the_omml_root() {
        assert!(document_from_omml(
            r#"<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"/><!--after-->"#,
        )
        .is_err());
    }

    #[test]
    fn rejects_comments_whose_body_ends_in_a_dash() {
        let omml = format!(
            "<!--comment--->{}",
            r#"<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"/>"#,
        );
        assert!(document_from_omml(&omml).is_err());
    }

    #[test]
    fn preserves_a_valid_single_omml_root() {
        assert!(document_from_omml(valid_omml()).is_ok());
    }

    #[test]
    fn rejects_multiple_roots_even_when_separated_by_whitespace() {
        assert!(document_from_omml(
            r#"<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"></m:oMath>   <m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"></m:oMath>"#,
        )
        .is_err());
    }

    #[test]
    fn writes_exactly_the_three_required_docx_parts() {
        let bytes = document_from_omml(
            r#"<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><m:r><m:t>x</m:t></m:r></m:oMath>"#,
        )
        .unwrap();
        let mut archive = ZipArchive::new(Cursor::new(bytes)).unwrap();
        assert_eq!(archive.len(), 3);

        let mut names = (0..archive.len())
            .map(|index| archive.by_index(index).unwrap().name().to_owned())
            .collect::<Vec<_>>();
        names.sort();
        assert_eq!(
            names,
            vec!["[Content_Types].xml", "_rels/.rels", "word/document.xml",]
        );

        let mut content_types = String::new();
        archive
            .by_name("[Content_Types].xml")
            .unwrap()
            .read_to_string(&mut content_types)
            .unwrap();
        assert_eq!(
            content_types,
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/></Types>"
        );

        let mut relationships = String::new();
        archive
            .by_name("_rels/.rels")
            .unwrap()
            .read_to_string(&mut relationships)
            .unwrap();
        assert_eq!(
            relationships,
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/></Relationships>"
        );
    }
}
