//! Minimal RFC 5322 message split: header fields (folds kept) and body bytes.

#[derive(Debug, Clone)]
pub struct Header {
    pub name: String,
    /// Raw field `Name: value` with internal folds, without the final CRLF.
    pub raw: Vec<u8>,
}

#[derive(Debug)]
pub struct Message {
    pub headers: Vec<Header>,
    pub body: Vec<u8>,
}

/// Turn bare LF into CRLF so fixtures and transports hash the same.
pub fn normalize_crlf(src: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(src.len() + 64);
    for (i, &b) in src.iter().enumerate() {
        if b == b'\n' && (i == 0 || src[i - 1] != b'\r') {
            out.push(b'\r');
        }
        out.push(b);
    }
    out
}

fn find(hay: &[u8], needle: &[u8]) -> Option<usize> {
    hay.windows(needle.len()).position(|w| w == needle)
}

pub fn parse(src: &[u8]) -> Result<Message, String> {
    let data = normalize_crlf(src);
    let (head, body) = if data.starts_with(b"\r\n") {
        (&data[..0], data[2..].to_vec())
    } else {
        match find(&data, b"\r\n\r\n") {
            Some(i) => (&data[..i], data[i + 4..].to_vec()),
            None => return Err("no header/body separator".into()),
        }
    };
    let mut headers: Vec<Header> = Vec::new();
    for line in head.split(|&b| b == b'\n') {
        let line = line.strip_suffix(b"\r").unwrap_or(line);
        if line.first().is_some_and(|b| *b == b' ' || *b == b'\t') {
            let last = headers.last_mut().ok_or("fold before first header")?;
            last.raw.extend_from_slice(b"\r\n");
            last.raw.extend_from_slice(line);
        } else if let Some(c) = line.iter().position(|&b| b == b':') {
            let name = String::from_utf8_lossy(&line[..c]).trim().to_string();
            headers.push(Header { name, raw: line.to_vec() });
        } else if !line.is_empty() {
            return Err("malformed header line".into());
        }
    }
    Ok(Message { headers, body })
}

impl Message {
    pub fn header(&self, name: &str) -> Option<&Header> {
        self.headers.iter().rev().find(|h| h.name.eq_ignore_ascii_case(name))
    }
}

impl Header {
    pub fn value(&self) -> String {
        let c = self.raw.iter().position(|&b| b == b':').unwrap_or(0);
        let v = String::from_utf8_lossy(&self.raw[c + 1..]).replace("\r\n", "");
        v.trim().to_string()
    }
}
