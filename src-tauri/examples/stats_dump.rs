fn main() {
    let stats = token_watch_lib::claude_stats_export::compute_stats("all");
    println!("{}", serde_json::to_string_pretty(&stats).unwrap());
}
