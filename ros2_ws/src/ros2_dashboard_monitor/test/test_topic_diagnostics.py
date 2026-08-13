import pytest

from ros2_dashboard_monitor.ros2_topic.diagnostics import reception_diagnosis


def _topic(**values):
    return {
        'name': '/scan',
        'publisher_count': 1,
        'hz_monitoring_status': 'active',
        **values,
    }


def _subscription(*, last_received_at=None, status='unknown', source='graph_unavailable'):
    return {
        'last_received_at': last_received_at,
        'qos': {
            'qos_status': status,
            'qos_detection_source': source,
            'local_qos': {'reliability': 'reliable'},
            'remote_qos': [{'qos': {'reliability': 'best_effort'}}],
            'mismatch_policies': ['reliability'] if status == 'incompatible' else [],
        },
    }


@pytest.mark.parametrize(
    ('status', 'source', 'cause', 'certainty'),
    [
        ('incompatible', 'graph_profile_comparison', 'qos_incompatible', 'candidate'),
        ('incompatible', 'incompatible_qos_event', 'qos_incompatible', 'confirmed'),
        ('compatible', 'graph_profile_comparison', 'non_qos_receive_path', 'candidate'),
        ('unknown', 'graph_unavailable', 'qos_unconfirmed', 'unknown'),
        ('observed', 'graph_endpoint_info', 'qos_unconfirmed', 'unknown'),
    ],
)
def test_never_received_diagnosis_uses_existing_qos_evidence(
    status, source, cause, certainty,
) -> None:
    diagnosis = reception_diagnosis(
        topic=_topic(), subscription=_subscription(status=status, source=source),
        subscription_error=None, observed_at=10.0, stale_timeout_sec=3.0,
    )

    assert diagnosis['reception_status'] == 'never_received'
    assert diagnosis['cause'] == cause
    assert diagnosis['certainty'] == certainty


def test_subscription_failure_has_priority_over_qos() -> None:
    diagnosis = reception_diagnosis(
        topic=_topic(hz_monitoring_status='subscription_failed'),
        subscription=None, subscription_error='cannot create subscription',
        observed_at=10.0, stale_timeout_sec=3.0,
    )

    assert diagnosis['cause'] == 'subscription_failed'
    assert diagnosis['certainty'] == 'confirmed'


def test_unmonitored_topic_without_subscription_has_no_receive_diagnosis() -> None:
    assert reception_diagnosis(
        topic=_topic(hz_monitoring_status='not_configured'),
        subscription=None, subscription_error=None,
        observed_at=10.0, stale_timeout_sec=3.0,
    ) is None


@pytest.mark.parametrize(
    ('publisher_count', 'cause'),
    [(1, 'publisher_data_stopped'), (0, 'publisher_missing')],
)
def test_stale_diagnosis_distinguishes_publisher_presence(
    publisher_count, cause,
) -> None:
    diagnosis = reception_diagnosis(
        topic=_topic(publisher_count=publisher_count),
        subscription=_subscription(last_received_at=1.0, status='compatible'),
        subscription_error=None, observed_at=10.0, stale_timeout_sec=3.0,
    )

    assert diagnosis['reception_status'] == 'stale'
    assert diagnosis['cause'] == cause
