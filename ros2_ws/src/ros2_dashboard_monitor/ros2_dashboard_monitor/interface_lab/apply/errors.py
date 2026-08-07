"""Interface Apply 공개 오류 타입."""


class InterfaceApplyInProgress(RuntimeError):
    """동시에 두 개의 Interface build가 요청됐을 때 발생합니다."""


class InterfaceApplyError(RuntimeError):
    """Interface build/apply 상태 또는 workspace 처리가 실패했을 때 발생합니다."""
