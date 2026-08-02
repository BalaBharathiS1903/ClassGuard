from celery import shared_task
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import logging
import time

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3)
def process_detection_frame(self, camera_id):
    time.sleep(1)
    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            "alerts",
            {
                "type": "send_alert",
                "message": f"Alert generated from camera {camera_id}"
            }
        )
    except Exception as exc:
        logger.error("process_detection_frame failed for camera %s: %s", camera_id, exc)
        raise self.retry(exc=exc, countdown=5)
    return True
