# ROS2 Dashboard: ROS_DOMAIN_ID 우선순위 및 파싱 취약점 개선 보고서

---

### 1. 작업 개요

Fresh Ubuntu 환경에서 `./scripts/install.sh` 실행 시 `backend/.env`와 `/etc/ros2-dashboard/dashboard.env`에 기본값 `ROS_DOMAIN_ID=0`이 저장된 이후, 사용자가 터미널에서 `export ROS_DOMAIN_ID=99` 후 `./scripts/start.sh`를 실행해도 `backend/.env`의 값이 우선되어 shell 변수가 무시되던 문제와, 인라인 주석/공백/따옴표 등으로 인해 정수 범위 검증(0~232)이 실패하던 문제를 수정했습니다.

---

### 2. 우선순위 변경 내용

#### 기존 우선순위
```text
1. backend/.env의 ROS_DOMAIN_ID
2. 현재 shell의 ROS_DOMAIN_ID (backend/.env에 값이 없을 때만)
3. runtime env (/etc/ros2-dashboard/dashboard.env)
4. 기본값 0
```

#### 변경된 우선순위
```text
1. 설치 전용 override (ROS2_DASHBOARD_ROS_DOMAIN_ID, install.sh 전용)
2. 현재 shell의 ROS_DOMAIN_ID (명시적으로 설정된 경우 최우선)
3. backend/.env의 ROS_DOMAIN_ID (마지막 저장된 persistent 설정)
4. runtime env (/etc/ros2-dashboard/dashboard.env)
5. 기본값 0
```

---

### 3. 수정한 파일 및 핵심 코드 변경

#### 1) `scripts/lib/ros_runtime_env.sh`
- `ros_dashboard_trim_env_value()` 함수 추가: 주석(` # ...`), 앞뒤 공백, 따옴표(`"`, `'`), `\r`을 안전하게 제거.
- `ros_dashboard_read_env_value()`: trim 함수를 적용하여 `.env` 내 값 안전 추출.
- `ros_dashboard_set_env_value()`: 앞에 공백이 있는 라인(`^[[:space:]]*${key}=`)도 안전하게 치환.
- `ros_dashboard_resolve_runtime_env()`: 우선순위를 `shell_domain` -> `project_domain` -> `0`으로 변경.

```bash
ros_dashboard_trim_env_value() {
  local raw="${1:-}" val
  raw="${raw%$'\r'}"
  raw="$(printf '%s' "$raw" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
  if [[ "$raw" =~ ^\"([^\"]*)\"([[:space:]]*#.*)?$ ]]; then
    val="${BASH_REMATCH[1]}"
  elif [[ "$raw" =~ ^\'([^\']*)\'([[:space:]]*#.*)?$ ]]; then
    val="${BASH_REMATCH[1]}"
  else
    val="$(printf '%s' "$raw" | sed -E 's/[[:space:]]*#.*$//' | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
  fi
  printf '%s' "$val"
}

ros_dashboard_resolve_runtime_env() {
  local project_env="$1" allow_install_override="${2:-false}"
  local project_domain="" project_rmw=""
  local shell_domain="" shell_rmw=""
  local install_override_domain="" install_override_rmw=""

  project_domain="$(ros_dashboard_read_env_value "$project_env" ROS_DOMAIN_ID || true)"
  project_rmw="$(ros_dashboard_read_env_value "$project_env" RMW_IMPLEMENTATION || true)"

  shell_domain="$(ros_dashboard_trim_env_value "${ROS_DOMAIN_ID:-}")"
  shell_rmw="$(ros_dashboard_trim_env_value "${RMW_IMPLEMENTATION:-}")"

  install_override_domain="$(ros_dashboard_trim_env_value "${ROS2_DASHBOARD_ROS_DOMAIN_ID:-}")"
  install_override_rmw="$(ros_dashboard_trim_env_value "${ROS2_DASHBOARD_RMW_IMPLEMENTATION:-}")"

  if [[ "$allow_install_override" == true ]]; then
    ROS_DASHBOARD_DOMAIN_ID="${install_override_domain:-${shell_domain:-${project_domain:-0}}}"
    ROS_DASHBOARD_RMW_IMPLEMENTATION="${install_override_rmw:-${shell_rmw:-${project_rmw:-rmw_fastrtps_cpp}}}"
  else
    ROS_DASHBOARD_DOMAIN_ID="${shell_domain:-${project_domain:-0}}"
    ROS_DASHBOARD_RMW_IMPLEMENTATION="${shell_rmw:-${project_rmw:-rmw_fastrtps_cpp}}"
  fi

  if [[ ! "$ROS_DASHBOARD_DOMAIN_ID" =~ ^[0-9]+$ \
      || ${#ROS_DASHBOARD_DOMAIN_ID} -gt 3 ]] \
      || (( 10#$ROS_DASHBOARD_DOMAIN_ID > 232 )); then
    echo "[ros2_dashboard] ROS_DOMAIN_ID must be an integer from 0 to 232." >&2
    return 1
  fi
}
```

#### 2) `scripts/start.sh`
- shell에서 새로 결정된 `ROS_DOMAIN_ID`를 `backend/.env`에도 동기화 저장하여 영속성 확보.
- `/etc/ros2-dashboard/dashboard.env`의 값과 다를 경우 systemd Monitor 자동 재시작.

```bash
ros_dashboard_migrate_runtime_env "$PROJECT_ENV" "$RUNTIME_ENV"
ros_dashboard_resolve_runtime_env "$PROJECT_ENV"

if [[ -f "$PROJECT_ENV" ]]; then
  project_domain="$(ros_dashboard_read_env_value "$PROJECT_ENV" ROS_DOMAIN_ID || true)"
  if [[ "$project_domain" != "$ROS_DASHBOARD_DOMAIN_ID" ]]; then
    ros_dashboard_set_env_value "$PROJECT_ENV" ROS_DOMAIN_ID "$ROS_DASHBOARD_DOMAIN_ID"
  fi
  project_rmw="$(ros_dashboard_read_env_value "$PROJECT_ENV" RMW_IMPLEMENTATION || true)"
  if [[ "$project_rmw" != "$ROS_DASHBOARD_RMW_IMPLEMENTATION" ]]; then
    ros_dashboard_set_env_value "$PROJECT_ENV" RMW_IMPLEMENTATION "$ROS_DASHBOARD_RMW_IMPLEMENTATION"
  fi
fi
```

#### 3) `scripts/run_dashboard_stack.sh`
- 개발 모드 스택 실행 시에도 shell의 `ROS_DOMAIN_ID`가 `backend/.env`에 자동 저장되도록 보강.

#### 4) `scripts/install.sh`
- step 7에서 sudo 실행 시 `INSTALL_USER`의 shell 환경변수를 fallback으로 감지하여 설치 설정에 반영.

#### 5) 관련 문서 동기화
- `docs/architecture/configuration.md`
- `docs/docs2/01_environment_setup.md`
- `.codex/CURRENT_STATUS.md`
- `.codex/WORK_LOG.md`

---

### 4. 시나리오별 검증 결과

| 시나리오 | 초기 상태 및 입력 | 실행 결과 | 판정 |
|---|---|---|---|
| **시나리오 1** | `backend/.env = 0`<br>`shell = ROS_DOMAIN_ID=99` | `backend/.env = 99`<br>`runtime env = 99`<br>`status = ROS domain 99` | **PASS** |
| **시나리오 2** | `shell 미설정`<br>`backend/.env = 99` | `Domain 99 유지`<br>`backend/.env = 99`, `runtime env = 99` | **PASS** |
| **시나리오 3** | `backend/.env = 99`<br>`shell = ROS_DOMAIN_ID=42` | `backend/.env = 42`<br>`runtime env = 42`<br>`status = ROS domain 42` | **PASS** |
| **시나리오 4** | 마지막 저장 Domain = 42<br>재부팅 (shell 미설정) | systemd Monitor가 `runtime env`의 `Domain 42`로 자동 실행 | **PASS** |
| **시나리오 5** | `shell = ROS_DOMAIN_ID=999` | `[ros2_dashboard] ROS_DOMAIN_ID must be an integer from 0 to 232.` 에러 출력 및 파일 보존 (exit 1) | **PASS** |
| **시나리오 6** | `unset ROS_DOMAIN_ID`<br>Fresh 설치 초기화 | `Domain 0`으로 정상 초기화 및 실행 | **PASS** |

---

### 5. 기존 테스트 및 회귀 검증

- **Backend Pytest**: `16 passed, 2 skipped` (100% 통과)
- **Monitor Pytest**: `249 passed` (100% 통과)
- **Frontend Test Suite**: unit tests 36개 통과, `oxlint` 통과, `vite build` 정상 완료

---

### 6. Fresh Ubuntu 사용자 가이드

```bash
# 1. 설치 전 환경변수를 지정하는 경우
export ROS_DOMAIN_ID=99
./scripts/install.sh

# 2. 기본 설치 후 실행 시 Domain을 변경하는 경우
./scripts/install.sh
export ROS_DOMAIN_ID=99
./scripts/start.sh

# 3. 상태 확인
./scripts/status.sh
# ROS domain       99
```

---

### 해당 코드 작업에서 내가 알아야 할 것 3줄 요약

1. `start.sh`와 `install.sh` 모두 현재 shell의 `ROS_DOMAIN_ID`를 `backend/.env`보다 최우선으로 반영하도록 교정했습니다.
2. shell에서 변경된 Domain 값은 `backend/.env`와 `/etc/ros2-dashboard/dashboard.env`에 즉시 동기화 저장되어 Monitor가 자동 재시작되고 재부팅 후에도 유지됩니다.
3. 파서에 공백/주석/따옴표/`\r` 정제 로직을 추가하여 정수 범위(0~232) 검증 오류 없이 안전하게 처리됩니다.
