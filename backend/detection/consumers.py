import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class AlertConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # --- Security: Reject unauthenticated WebSocket connections ---
        user = self.scope.get('user')
        if not user or user.is_anonymous:
            logger.warning("WebSocket connection rejected: unauthenticated user")
            await self.close(code=4001)
            return

        self.group_name = "alerts"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info(f"WebSocket connected: user={user.username}")

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        # Client isn't expected to send much, but just in case
        pass

    async def send_alert(self, event):
        message = event['message']
        await self.send(text_data=json.dumps({
            'message': message
        }))
