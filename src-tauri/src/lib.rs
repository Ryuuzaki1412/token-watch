use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

const MINIMAX_REMAINS_URL: &str = "https://api.minimaxi.com/v1/token_plan/remains";

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct BaseResponse {
    #[serde(default)]
    status_code: i64,
    #[serde(default)]
    status_msg: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct ModelRemain {
    #[serde(default)]
    start_time: i64,
    #[serde(default)]
    end_time: i64,
    #[serde(default)]
    remains_time: i64,
    #[serde(default)]
    current_interval_total_count: i64,
    #[serde(default)]
    current_interval_usage_count: i64,
    #[serde(default)]
    model_name: String,
    #[serde(default)]
    current_weekly_total_count: i64,
    #[serde(default)]
    current_weekly_usage_count: i64,
    #[serde(default)]
    weekly_start_time: i64,
    #[serde(default)]
    weekly_end_time: i64,
    #[serde(default)]
    weekly_remains_time: i64,
    #[serde(default)]
    current_interval_status: i64,
    #[serde(default)]
    current_interval_remaining_percent: i64,
    #[serde(default)]
    current_weekly_status: i64,
    #[serde(default)]
    current_weekly_remaining_percent: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct TokenPlanResponse {
    #[serde(default)]
    model_remains: Vec<ModelRemain>,
    #[serde(default)]
    base_resp: BaseResponse,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
struct ErrorResponse {
    #[serde(default)]
    base_resp: Option<BaseResponse>,
}

fn response_error(status: reqwest::StatusCode, body: &str) -> String {
    let api_message = serde_json::from_str::<ErrorResponse>(body)
        .ok()
        .and_then(|response| response.base_resp)
        .map(|response| response.status_msg)
        .filter(|message| !message.trim().is_empty());

    match api_message {
        Some(message) => format!("Minimax 返回异常（{}）：{}", status.as_u16(), message),
        None => format!("Minimax 返回异常（HTTP {}）", status.as_u16()),
    }
}

#[tauri::command]
async fn fetch_token_plan(provider: String, api_key: String) -> Result<TokenPlanResponse, String> {
    if provider != "minimax" {
        return Err("暂时只支持 Minimax Provider".to_string());
    }

    let key = api_key.trim();
    if key.len() < 8 {
        return Err("API Key 看起来不完整".to_string());
    }

    let client = Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(25))
        .build()
        .map_err(|_| "无法初始化网络连接".to_string())?;

    let response = client
        .get(MINIMAX_REMAINS_URL)
        .bearer_auth(key)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|_| "无法连接 Minimax，请检查网络后重试".to_string())?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|_| "无法读取 Minimax 返回结果".to_string())?;

    if !status.is_success() {
        return Err(response_error(status, &body));
    }

    let payload = serde_json::from_str::<TokenPlanResponse>(&body)
        .map_err(|_| "Minimax 返回的数据格式无法识别".to_string())?;

    if payload.base_resp.status_code != 0 {
        let message = payload.base_resp.status_msg.trim();
        if message.is_empty() {
            return Err(format!(
                "Minimax 请求失败（{}）",
                payload.base_resp.status_code
            ));
        }
        return Err(format!("Minimax 请求失败：{}", message));
    }

    Ok(payload)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![fetch_token_plan])
        .run(tauri::generate_context!())
        .expect("error while running token watch");
}
