use std::sync::Mutex;
use std::net::TcpListener;
use tauri::{State, Manager};
use tauri_plugin_shell::process::CommandChild;

struct BackendPort(u16);
struct BackendChild(Mutex<Option<CommandChild>>);

#[tauri::command]
fn get_backend_port(port: State<'_, BackendPort>) -> u16 {
    port.0
}

#[tauri::command]
async fn restart_neural_engine(
    app: tauri::AppHandle,
    child_state: State<'_, BackendChild>,
    port_state: State<'_, BackendPort>
) -> Result<String, String> {
    use tauri_plugin_shell::ShellExt;
    
    let port = port_state.0;
    
    // 1. Kill existing child if any
    {
        let mut guard = child_state.0.lock().unwrap();
        if let Some(child) = guard.take() {
            let _ = child.kill();
        }
    }

    // 2. Prep paths exactly like setup
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let state_dir = app_data.join("state");
    let data_dir = app_data.join("data");
    let settings_dir = app_data.join("settings");

    // 3. Spawn fresh sidecar
    #[cfg(debug_assertions)]
    let sidecar_command = {
        let tauri_dir = std::env::current_dir().unwrap_or_default();
        let project_root = tauri_dir.parent().map(|p| p.to_path_buf()).unwrap_or(tauri_dir);
        let main_py_path = project_root.join("src-python/main.py");
        
        let py_path = if cfg!(windows) {
            let venv_py = project_root.join("../packages/shared-backend/.venv/Scripts/python.exe");
            if venv_py.exists() { venv_py.to_string_lossy().to_string() } else { "python".to_string() }
        } else {
            let venv_py = project_root.join("../packages/shared-backend/.venv/bin/python3");
            if venv_py.exists() { venv_py.to_string_lossy().to_string() } else { "python3".to_string() }
        };

        app.shell()
            .command(py_path)
            .env("EAGLE_STATE_DIR", &state_dir)
            .env("EAGLE_DATA_DIR", &data_dir)
            .env("EAGLE_SETTINGS_DIR", &settings_dir)
            .current_dir(&app_data)
            .args([main_py_path.to_string_lossy().to_string(), "--port".to_string(), port.to_string()])
    };

    #[cfg(not(debug_assertions))]
    let sidecar_command = app.shell().sidecar("eagle-sidecar").map_err(|e| e.to_string())?
        .env("EAGLE_STATE_DIR", &state_dir)
        .env("EAGLE_DATA_DIR", &data_dir)
        .env("EAGLE_SETTINGS_DIR", &settings_dir)
        .current_dir(&app_data)
        .args(["--port", &port.to_string()]);

    let (_rx, new_child) = sidecar_command.spawn().map_err(|e| e.to_string())?;
    
    // 4. Update state
    {
        let mut guard = child_state.0.lock().unwrap();
        *guard = Some(new_child);
    }

    Ok("Neural Engine restarted successfully".to_string())
}

#[tauri::command]
async fn read_eagle_state(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    use std::fs;
    use tauri::Manager;

    let path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("state/eagle_ai_state.json");

    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                return Ok(json);
            }
        }
    }
    
    Err("Industrial state file not found".to_string())
}

#[tauri::command]
async fn write_eagle_state(app: tauri::AppHandle, content: String) -> Result<(), String> {
    use std::fs;
    use tauri::Manager;

    let path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("state/eagle_ai_state.json");

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    fs::write(&path, content).map_err(|e| e.to_string())
}

fn get_available_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .and_then(|listener| listener.local_addr())
        .map(|addr| addr.port())
        .unwrap_or(6789)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let target_port = get_available_port();
    
    tauri::Builder::default()
        .manage(BackendPort(target_port))
        .manage(BackendChild(Mutex::new(None)))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            get_backend_port, 
            read_eagle_state, 
            write_eagle_state,
            restart_neural_engine
        ])
        .setup(move |app| {
            use tauri::Manager;
            use tauri_plugin_shell::ShellExt;
            use tauri_plugin_shell::process::CommandEvent;
            use std::fs::OpenOptions;
            use std::io::Write;

            let mut log_file = {
                let log_path = app.path().home_dir().unwrap_or_default().join(".eagle_ai_boot.log");
                OpenOptions::new().create(true).append(true).open(log_path).ok()
            };

            let mut log = |msg: &str| {
                if let Some(ref mut f) = log_file {
                    let _ = writeln!(f, "[BOOT {}] {}", chrono::Local::now().format("%Y-%m-%d %H:%M:%S"), msg);
                }
                println!("{}", msg);
            };

            log("Initializing EagleAI Industrial Core...");

            let app_data = app.path().app_data_dir().unwrap_or_default();
            let state_dir = app_data.join("state");
            let data_dir = app_data.join("data");
            let settings_dir = app_data.join("settings");

            let _ = std::fs::create_dir_all(&state_dir);
            let _ = std::fs::create_dir_all(&data_dir);
            let _ = std::fs::create_dir_all(&settings_dir);

            // 2. Resource Migration (Seed defaults if missing)
            let state_files = vec!["predictions.json", "eagleai_predictions.json", "machines_pred.json", "eagle_ai_state.json"];
            let data_files = vec!["production_data_live.xls"];

            for file in state_files {
                let dest = state_dir.join(file);
                if !dest.exists() {
                    let mut src_path = None;
                    let possible_paths = vec![
                        format!("_up_/src-python/state/{}", file),
                        format!("state/{}", file),
                        format!("resources/state/{}", file),
                        file.to_string()
                    ];
                    
                    for p in possible_paths {
                        if let Ok(path) = app.path().resolve(&p, tauri::path::BaseDirectory::Resource) {
                            if path.exists() {
                                src_path = Some(path);
                                break;
                            }
                        }
                    }

                    if let Some(src) = src_path {
                        log(&format!("Seeding state file: {}", file));
                        let _ = std::fs::copy(src, dest);
                    }
                }
            }

            for file in data_files {
                let dest = data_dir.join(file);
                if !dest.exists() {
                    let mut src_path = None;
                    let possible_paths = vec![
                        format!("_up_/src-python/data/{}", file),
                        format!("data/{}", file),
                        format!("resources/data/{}", file),
                        file.to_string()
                    ];
                    
                    for p in possible_paths {
                        if let Ok(path) = app.path().resolve(&p, tauri::path::BaseDirectory::Resource) {
                            if path.exists() {
                                src_path = Some(path);
                                break;
                            }
                        }
                    }

                    if let Some(src) = src_path {
                        log(&format!("Seeding data file: {}", file));
                        let _ = std::fs::copy(src, dest);
                    }
                }
            }

            // Spawn Initial Sidecar
            #[cfg(debug_assertions)]
            let sidecar_command = {
                let project_root = std::env::current_dir().unwrap_or_default().parent().map(|p| p.to_path_buf()).unwrap();
                let main_py = project_root.join("src-python/main.py");
                
                let py_cmd = if cfg!(windows) { "python" } else { "python3" };
                
                app.shell().command(py_cmd)
                    .env("EAGLE_STATE_DIR", &state_dir)
                    .env("EAGLE_DATA_DIR", &data_dir)
                    .env("EAGLE_SETTINGS_DIR", &settings_dir)
                    .current_dir(&app_data)
                    .args([main_py.to_string_lossy().to_string(), "--port".to_string(), target_port.to_string()])
            };

            #[cfg(not(debug_assertions))]
            let sidecar_command = app.shell().sidecar("eagle-sidecar").unwrap()
                .env("EAGLE_STATE_DIR", &state_dir)
                .env("EAGLE_DATA_DIR", &data_dir)
                .env("EAGLE_SETTINGS_DIR", &settings_dir)
                .current_dir(&app_data)
                .args(["--port", &target_port.to_string()]);

            match sidecar_command.spawn() {
                Ok((mut rx, _child)) => {
                    log("SIDE CAR STARTED SUCCESSFULLY");
                    let child_state = app.state::<BackendChild>();
                    *child_state.0.lock().unwrap() = Some(_child);

                    tauri::async_runtime::spawn(async move {
                        while let Some(event) = rx.recv().await {
                            if let CommandEvent::Terminated(payload) = event {
                                println!("Sidecar terminated with code {:?}", payload.code);
                            }
                        }
                    });
                }
                Err(e) => log(&format!("SIDE CAR FAILED: {}", e)),
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
