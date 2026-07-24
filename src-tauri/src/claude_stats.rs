//! Read Claude Code's local JSONL session logs and compute usage statistics.
//!
//! Data source: `~/.claude/projects/**/*.jsonl` (one file per session).
//! Each line is a JSON event; the only ones we care about are `type: "assistant"`
//! entries, which carry a `message.usage` object with token counts and a `model`.

use serde::Serialize;
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::PathBuf;
use std::time::{Duration, UNIX_EPOCH};

#[derive(Debug, Default, Clone, Copy)]
struct Usage {
    input: u64,
    output: u64,
    cache_create: u64,
    cache_read: u64,
}

impl Usage {
    fn total(&self) -> u64 {
        self.input + self.output + self.cache_create + self.cache_read
    }
    fn add(&mut self, other: Usage) {
        self.input += other.input;
        self.output += other.output;
        self.cache_create += other.cache_create;
        self.cache_read += other.cache_read;
    }
}

#[derive(Debug, Default, Clone)]
struct SessionStats {
    first_ts: Option<i64>,
    last_ts: Option<i64>,
    usage: Usage,
}

#[derive(Debug, Serialize)]
pub struct ClaudeStats {
    pub totals: Totals,
    pub sessions: u32,
    pub active_days: u32,
    pub first_activity: String,
    pub last_activity: String,
    pub longest_session: SessionDuration,
    pub longest_streak: u32,
    pub current_streak: u32,
    pub most_active_day: DayStat,
    pub favorite_model: String,
    pub models: Vec<ModelUsage>,
    pub range: String,
    pub range_tokens: u64,
    pub heatmap: Heatmap,
}

#[derive(Debug, Serialize)]
pub struct Totals {
    pub input: u64,
    pub output: u64,
    pub cache_create: u64,
    pub cache_read: u64,
    pub grand: u64,
}

#[derive(Debug, Serialize)]
pub struct SessionDuration {
    pub ms: u64,
    pub display: String,
}

#[derive(Debug, Serialize)]
pub struct DayStat {
    pub date: String,
    pub tokens: u64,
}

#[derive(Debug, Serialize)]
pub struct ModelUsage {
    pub name: String,
    pub tokens: u64,
    pub percent: f64,
}

#[derive(Debug, Serialize)]
pub struct Heatmap {
    pub weeks: u32,
    /// 7 rows × N cols (Mon..Sun). Each cell is a `HeatCell`.
    pub rows: Vec<Vec<HeatCell>>,
    /// Month label spans placed on the top edge: e.g. {start_col: 0, end_col: 4, label: "Jun"}
    pub month_labels: Vec<MonthSpan>,
}

#[derive(Debug, Clone, Serialize)]
pub struct HeatCell {
    pub date: Option<String>, // YYYY-MM-DD if this cell has data, None if padding
    pub tokens: u64,
    pub density: u8, // 0..5
    pub in_range: bool,
}

#[derive(Debug, Serialize)]
pub struct MonthSpan {
    pub start_col: u32,
    pub end_col: u32,
    pub label: String,
}

fn claude_projects_dir() -> Option<PathBuf> {
    let home = std::env::var_os("HOME")?;
    let dir = PathBuf::from(home).join(".claude").join("projects");
    if dir.exists() { Some(dir) } else { None }
}

fn parse_ts_ms(s: &str) -> Option<i64> {
    // RFC3339 / ISO 8601 with optional fractional seconds and Z.
    // Hand-rolled to avoid a chrono dependency; we only need a coarse ms value.
    // Format: 2026-07-13T11:15:03.793Z  or  2026-07-13T11:15:03Z
    let bytes = s.as_bytes();
    let n = bytes.len();
    if n < 20 { return None; }
    let read = |i: usize| -> Option<u64> {
        let mut v: u64 = 0;
        for &b in &bytes[i..i+2] {
            if !b.is_ascii_digit() { return None; }
            v = v * 10 + (b - b'0') as u64;
        }
        Some(v)
    };
    let y  = (0..4).fold(0u64, |a, i| a * 10 + (bytes[i] - b'0') as u64);
    let mo = read(5)?;
    let d  = read(8)?;
    let h  = read(11)?;
    let mi = read(14)?;
    let s_ = read(17)?;
    // Compose using chrono-free arithmetic via unix epoch days
    // Days since 1970-01-01
    let days = days_from_civil(y as i32, mo as u32, d as u32);
    let secs = days as i64 * 86400 + (h as i64) * 3600 + (mi as i64) * 60 + s_ as i64;
    Some(secs * 1000)
}

// Howard Hinnant's days_from_civil, public domain.
fn days_from_civil(y: i32, m: u32, d: u32) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = (y - era * 400) as u64;
    let m = m as i64;
    let d = d as i64;
    let doy = (153 * (if m > 2 { m - 3 } else { m + 9 }) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy as u64;
    era as i64 * 146097 + doe as i64 - 719468
}

fn ms_to_iso(ms: i64) -> String {
    if ms <= 0 { return String::new(); }
    let secs = ms / 1000;
    let dt = UNIX_EPOCH + Duration::from_secs(secs as u64);
    // Build YYYY-MM-DDTHH:MM:SSZ without pulling chrono
    let secs_i64 = dt.duration_since(UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0);
    let days = secs_i64 / 86400;
    let rem = secs_i64.rem_euclid(86400);
    let h = rem / 3600;
    let mi = (rem / 60) % 60;
    let s = rem % 60;
    let (y, m, d) = civil_from_days(days);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        y, m, d, h, mi, s
    )
}

fn civil_from_days(z: i64) -> (i32, u32, u32) {
    let z = z + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = (if mp < 10 { mp + 3 } else { mp - 9 }) as u32;
    let y = if m <= 2 { y + 1 } else { y };
    (y as i32, m, d)
}

fn read_dir_files(root: &PathBuf) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let entries = match fs::read_dir(root) {
        Ok(e) => e,
        Err(_) => return out,
    };
    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_dir() {
            // Each project subdirectory contains session jsonl files
            if let Ok(sub) = fs::read_dir(&p) {
                for s in sub.flatten() {
                    let sp = s.path();
                    if sp.extension().and_then(|e| e.to_str()) == Some("jsonl") {
                        out.push(sp);
                    }
                }
            }
        } else if p.extension().and_then(|e| e.to_str()) == Some("jsonl") {
            out.push(p);
        }
    }
    out
}

fn parse_one_file(path: &PathBuf, sessions: &mut HashMap<String, SessionStats>, totals: &mut Usage, models: &mut HashMap<String, u64>) {
    let session_id = path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return,
    };
    for line in content.lines() {
        if line.is_empty() { continue; }
        let v: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        if v.get("type").and_then(|t| t.as_str()) != Some("assistant") { continue; }
        let msg = match v.get("message") {
            Some(m) => m,
            None => continue,
        };
        let usage = msg.get("usage");
        let u = Usage {
            input: usage.and_then(|u| u.get("input_tokens")).and_then(|n| n.as_u64()).unwrap_or(0),
            output: usage.and_then(|u| u.get("output_tokens")).and_then(|n| n.as_u64()).unwrap_or(0),
            cache_create: usage.and_then(|u| u.get("cache_creation_input_tokens")).and_then(|n| n.as_u64()).unwrap_or(0),
            cache_read: usage.and_then(|u| u.get("cache_read_input_tokens")).and_then(|n| n.as_u64()).unwrap_or(0),
        };
        if u.total() == 0 { continue; }
        totals.add(u);
        let ts_ms = v.get("timestamp").and_then(|t| t.as_str()).and_then(parse_ts_ms);
        let model = msg.get("model").and_then(|m| m.as_str()).unwrap_or("unknown").to_string();
        if let Some(ms) = ts_ms {
            let entry = sessions.entry(session_id.clone()).or_default();
            entry.usage.add(u);
            if entry.first_ts.map_or(true, |cur| ms < cur) { entry.first_ts = Some(ms); }
            if entry.last_ts.map_or(true, |cur| ms > cur) { entry.last_ts = Some(ms); }
        }
        *models.entry(model).or_insert(0) += u.total();
    }
}

fn format_session_duration(ms: u64) -> String {
    if ms == 0 { return "0m".to_string(); }
    let total_minutes = ms / 60_000;
    let days = total_minutes / (60 * 24);
    let hours = (total_minutes / 60) % 24;
    let minutes = total_minutes % 60;
    let mut parts = Vec::new();
    if days > 0 { parts.push(format!("{}d", days)); }
    if hours > 0 { parts.push(format!("{}h", hours)); }
    if minutes > 0 || parts.is_empty() { parts.push(format!("{}m", minutes)); }
    parts.join(" ")
}

pub fn compute_stats(range: &str) -> ClaudeStats {
    let mut sessions: HashMap<String, SessionStats> = HashMap::new();
    let mut totals = Usage::default();
    let mut models: HashMap<String, u64> = HashMap::new();

    if let Some(root) = claude_projects_dir() {
        let files = read_dir_files(&root);
        for f in files {
            parse_one_file(&f, &mut sessions, &mut totals, &mut models);
        }
    }

    let sessions_count = sessions.len() as u32;
    let mut active_days_set: BTreeMap<String, u64> = BTreeMap::new(); // date -> tokens
    for s in sessions.values() {
        let u = s.usage;
        // We approximate per-day as first_ts..last_ts. To get exact daily buckets
        // we'd need to walk each assistant entry's timestamp; for stats summaries
        // we instead use first_ts + 1 day per session for active days count.
        // For per-day totals, we'd need a finer pass — for now treat a session as
        // 1 day, which underestimates per-day tokens. Refine by reparsing.
        let _ = u;
    }

    // Re-pass to get accurate per-day totals: walk each file again, bucket by date.
    if let Some(root) = claude_projects_dir() {
        let files = read_dir_files(&root);
        for f in files {
            let content = match fs::read_to_string(&f) { Ok(c) => c, Err(_) => continue };
            for line in content.lines() {
                if line.is_empty() { continue; }
                let v: serde_json::Value = match serde_json::from_str(line) {
                    Ok(v) => v, Err(_) => continue,
                };
                if v.get("type").and_then(|t| t.as_str()) != Some("assistant") { continue; }
                let usage = match v.get("message").and_then(|m| m.get("usage")) {
                    Some(u) => u,
                    None => continue,
                };
                let inp = usage.get("input_tokens").and_then(|n| n.as_u64()).unwrap_or(0);
                let out = usage.get("output_tokens").and_then(|n| n.as_u64()).unwrap_or(0);
                let cc = usage.get("cache_creation_input_tokens").and_then(|n| n.as_u64()).unwrap_or(0);
                let cr = usage.get("cache_read_input_tokens").and_then(|n| n.as_u64()).unwrap_or(0);
                let tot = inp + out + cc + cr;
                if tot == 0 { continue; }
                let ts = match v.get("timestamp").and_then(|t| t.as_str()) { Some(s) => s, None => continue };
                // date = first 10 chars YYYY-MM-DD
                if ts.len() < 10 { continue; }
                let date = ts[..10].to_string();
                *active_days_set.entry(date).or_insert(0) += tot;
            }
        }
    }

    let first_activity_ms = sessions.values().filter_map(|s| s.first_ts).min().unwrap_or(0);
    let last_activity_ms = sessions.values().filter_map(|s| s.last_ts).max().unwrap_or(0);

    let longest_session = sessions.values()
        .filter_map(|s| match (s.first_ts, s.last_ts) {
            (Some(a), Some(b)) if b > a => Some((b - a) as u64),
            _ => None,
        })
        .max()
        .map(|ms| SessionDuration { ms, display: format_session_duration(ms) })
        .unwrap_or(SessionDuration { ms: 0, display: "0m".to_string() });

    // Streak calculation: count consecutive days in active_days_set ending at last_activity_date
    let sorted_dates: Vec<String> = active_days_set.keys().cloned().collect();
    let mut longest_streak = 0u32;
    let mut current_run = 0u32;
    let mut prev: Option<String> = None;
    for d in &sorted_dates {
        let is_consecutive = match &prev {
            Some(p) => days_between(p, d) == 1,
            None => false,
        };
        current_run = if is_consecutive { current_run + 1 } else { 1 };
        if current_run > longest_streak { longest_streak = current_run; }
        prev = Some(d.clone());
    }
    // Current streak: back from last_activity_date
    let mut current_streak = 0u32;
    if let Some(last_date) = sorted_dates.last().cloned() {
        let mut cursor = last_date;
        loop {
            if active_days_set.contains_key(&cursor) {
                current_streak += 1;
                cursor = previous_day(&cursor);
            } else { break; }
        }
    }

    let most_active_day = active_days_set.iter()
        .max_by_key(|(_, t)| *t)
        .map(|(d, t)| DayStat { date: d.clone(), tokens: *t })
        .unwrap_or(DayStat { date: String::new(), tokens: 0 });

    let mut model_vec: Vec<ModelUsage> = models.iter()
        .map(|(name, tokens)| ModelUsage {
            name: name.clone(),
            tokens: *tokens,
            percent: if totals.total() > 0 { (*tokens as f64 / totals.total() as f64) * 100.0 } else { 0.0 },
        })
        .collect();
    model_vec.sort_by(|a, b| b.tokens.cmp(&a.tokens));
    let favorite_model = model_vec.first().map(|m| m.name.clone()).unwrap_or_default();

    let active_days = active_days_set.len() as u32;

    // Range filter (for range_tokens; heatmap uses range too)
    let range_lower_ms = match range {
        "7d" => Some(last_activity_ms - 7 * 86400 * 1000),
        "30d" => Some(last_activity_ms - 30 * 86400 * 1000),
        _ => None,
    };
    let range_tokens = match range_lower_ms {
        Some(lower) => {
            let lower_date = ms_to_date_key(lower).unwrap_or_default();
            active_days_set.iter()
                .filter(|(d, _)| d.as_str() >= lower_date.as_str())
                .map(|(_, t)| *t)
                .sum()
        }
        None => totals.total(),
    };

    let heatmap = build_heatmap(&active_days_set, range_lower_ms, first_activity_ms, last_activity_ms);

    ClaudeStats {
        totals: Totals {
            input: totals.input,
            output: totals.output,
            cache_create: totals.cache_create,
            cache_read: totals.cache_read,
            grand: totals.total(),
        },
        sessions: sessions_count,
        active_days,
        first_activity: ms_to_iso(first_activity_ms),
        last_activity: ms_to_iso(last_activity_ms),
        longest_session,
        longest_streak,
        current_streak,
        most_active_day,
        favorite_model,
        models: model_vec,
        range: range.to_string(),
        range_tokens,
        heatmap,
    }
}

fn ms_to_date_key(ms: i64) -> Option<String> {
    let days = ms / 1000 / 86400;
    let (y, m, d) = civil_from_days(days);
    Some(format!("{:04}-{:02}-{:02}", y, m, d))
}

fn days_between(a: &str, b: &str) -> i64 {
    // Both YYYY-MM-DD
    let parse = |s: &str| -> i64 {
        let y: i32 = s[..4].parse().unwrap_or(1970);
        let m: u32 = s[5..7].parse().unwrap_or(1);
        let d: u32 = s[8..10].parse().unwrap_or(1);
        days_from_civil(y, m, d)
    };
    parse(b) - parse(a)
}

fn previous_day(date: &str) -> String {
    let y: i32 = date[..4].parse().unwrap_or(1970);
    let m: u32 = date[5..7].parse().unwrap_or(1);
    let d: u32 = date[8..10].parse().unwrap_or(1);
    let days = days_from_civil(y, m, d) - 1;
    let (ny, nm, nd) = civil_from_days(days);
    format!("{:04}-{:02}-{:02}", ny, nm, nd)
}

fn build_heatmap(per_day: &BTreeMap<String, u64>, range_lower_ms: Option<i64>, first_ms: i64, last_ms: i64) -> Heatmap {
    if per_day.is_empty() || last_ms == 0 {
        return Heatmap { weeks: 0, rows: vec![vec![HeatCell { date: None, tokens: 0, density: 0, in_range: false }; 0]; 7], month_labels: vec![] };
    }

    // Anchor first_ms's column to its Monday-of-week
    let first_date_key = ms_to_date_key(first_ms).unwrap_or_default();
    let first_dow = day_of_week_iso(&first_date_key); // 0=Mon..6=Sun
    let padded_first = add_days(&first_date_key, -(first_dow as i64));

    let last_date_key = ms_to_date_key(last_ms).unwrap_or_default();
    let total_days = days_between(&padded_first, &last_date_key) + 1;
    let weeks = ((total_days + 6) / 7) as u32;
    if weeks == 0 {
        return Heatmap { weeks: 0, rows: vec![vec![HeatCell { date: None, tokens: 0, density: 0, in_range: false }; 0]; 7], month_labels: vec![] };
    }

    let max_in_range = per_day.iter()
        .filter(|(d, _)| match range_lower_ms {
            Some(lower) => match ms_to_date_key(lower) { Some(s) => d.as_str() >= s.as_str(), None => true },
            None => true,
        })
        .map(|(_, t)| *t)
        .max()
        .unwrap_or(1)
        .max(1);

    let lower_date_key = range_lower_ms.and_then(ms_to_date_key);

    let mut rows: Vec<Vec<HeatCell>> = (0..7).map(|_| Vec::with_capacity(weeks as usize)).collect();
    for col in 0..weeks {
        for row in 0..7usize {
            let cell_date = add_days(&padded_first, (col as i64) * 7 + (row as i64));
            let tokens = per_day.get(&cell_date).copied().unwrap_or(0);
            let in_range = match &lower_date_key {
                Some(l) => cell_date.as_str() >= l.as_str(),
                None => true,
            };
            let density = if tokens == 0 {
                0
            } else {
                let r = tokens as f64 / max_in_range as f64;
                (r * 5.0).ceil().min(5.0) as u8
            };
            rows[row].push(HeatCell {
                date: Some(cell_date),
                tokens,
                density,
                in_range,
            });
        }
    }

    // Month labels: scan the top row, when month changes, write a span
    let mut month_labels: Vec<MonthSpan> = Vec::new();
    let mut current_month_label = String::new();
    let mut current_start = 0u32;
    for col in 0..weeks {
        let date = rows[0][col as usize].date.clone().unwrap_or_default();
        if date.is_empty() { continue; }
        let month_label = date[5..7].to_string();
        let pretty = month_number_to_name(&month_label).to_string();
        if col == 0 {
            current_month_label = pretty;
            current_start = 0;
        } else if pretty != current_month_label {
            month_labels.push(MonthSpan { start_col: current_start, end_col: col.saturating_sub(1), label: current_month_label.clone() });
            current_month_label = pretty;
            current_start = col;
        }
    }
    if let Some(last_col) = weeks.checked_sub(1) {
        month_labels.push(MonthSpan { start_col: current_start, end_col: last_col, label: current_month_label });
    }

    Heatmap { weeks, rows, month_labels }
}

fn day_of_week_iso(date: &str) -> i64 {
    let y: i32 = date[..4].parse().unwrap_or(1970);
    let m: u32 = date[5..7].parse().unwrap_or(1);
    let d: u32 = date[8..10].parse().unwrap_or(1);
    let days = days_from_civil(y, m, d);
    // 1970-01-01 was Thursday (= 4 in ISO)
    let dow = (days + 4).rem_euclid(7);
    dow
}

fn add_days(date: &str, days: i64) -> String {
    let y: i32 = date[..4].parse().unwrap_or(1970);
    let m: u32 = date[5..7].parse().unwrap_or(1);
    let d: u32 = date[8..10].parse().unwrap_or(1);
    let abs = days_from_civil(y, m, d) + days;
    let (ny, nm, nd) = civil_from_days(abs);
    format!("{:04}-{:02}-{:02}", ny, nm, nd)
}

fn month_number_to_name(m: &str) -> &'static str {
    match m {
        "01" => "Jan", "02" => "Feb", "03" => "Mar", "04" => "Apr",
        "05" => "May", "06" => "Jun", "07" => "Jul", "08" => "Aug",
        "09" => "Sep", "10" => "Oct", "11" => "Nov", "12" => "Dec",
        _ => "???",
    }
}

#[tauri::command]
pub fn fetch_claude_stats(range: Option<String>) -> ClaudeStats {
    let r = range.as_deref().unwrap_or("all");
    compute_stats(r)
}