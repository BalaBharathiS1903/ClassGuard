from urllib.parse import parse_qs
import logging
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken

logger = logging.getLogger(__name__)
User = get_user_model()


@database_sync_to_async
def get_user_from_jwt(token_str):
    try:
        token = AccessToken(token_str)
        user_id = token.get('user_id')
        if user_id:
            return User.objects.get(id=user_id)
    except Exception as e:
        logger.debug(f"JWT WebSocket authentication failed: {e}")
    return AnonymousUser()


class JwtAuthMiddleware:
    """Channels middleware to authenticate WebSocket connections via ?token=<jwt_access_token> query parameter."""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "websocket":
            query_string = scope.get("query_string", b"").decode("utf-8")
            query_params = parse_qs(query_string)
            token_list = query_params.get("token")
            if token_list:
                token_str = token_list[0]
                user = await get_user_from_jwt(token_str)
                if user and not user.is_anonymous:
                    scope["user"] = user
        return await self.inner(scope, receive, send)
