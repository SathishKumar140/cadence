import os
import httpx
from typing import Dict, Any

class LinkedInClient:
    def __init__(self):
        self.client_id = os.getenv("LINKEDIN_CLIENT_ID")
        self.client_secret = os.getenv("LINKEDIN_CLIENT_SECRET")
        self.redirect_uri = os.getenv("LINKEDIN_REDIRECT_URI", "http://localhost:8000/api/auth/linkedin/callback")
        self.auth_base_url = "https://www.linkedin.com/oauth/v2"
        self.api_base_url = "https://api.linkedin.com/v2"

    def get_authorization_url(self, state: str) -> str:
        scopes = "w_member_social openid profile email"
        return (
            f"{self.auth_base_url}/authorization?response_type=code"
            f"&client_id={self.client_id}"
            f"&redirect_uri={self.redirect_uri}"
            f"&state={state}"
            f"&scope={scopes.replace(' ', '%20')}"
        )

    async def get_access_token(self, code: str) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.auth_base_url}/accessToken",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.redirect_uri,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            response.raise_for_status()
            return response.json()

    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        # Using the OpenID Connect userinfo endpoint
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.linkedin.com/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            response.raise_for_status()
            return response.json()

    async def create_post(self, access_token: str, author_urn: str, text: str) -> Dict[str, Any]:
        # Modern /v2/posts endpoint
        async with httpx.AsyncClient() as client:
            # Reformat text to handle commentary requirements if needed
            payload = {
                "author": author_urn,
                "commentary": text,
                "visibility": "PUBLIC",
                "distribution": {
                    "feedDistribution": "MAIN_FEED",
                    "targetEntities": [],
                    "thirdPartyDistributionChannels": []
                },
                "lifecycleState": "PUBLISHED",
                "isReshareDisabledByAuthor": False
            }
            response = await client.post(
                f"{self.api_base_url}/posts",
                json=payload,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "X-Restli-Protocol-Version": "2.0.0",
                    "Content-Type": "application/json"
                }
            )
            
            # If v2/posts fails or is not available for this app type, fall back to ugcPosts
            if response.status_code != 201:
                # Fallback to older UGC implementation if necessary
                return await self._create_ugc_post(access_token, author_urn, text)
                
            return response.json() if response.text else {"status": "success"}

    async def _create_ugc_post(self, access_token: str, author_urn: str, text: str) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            payload = {
                "author": author_urn,
                "lifecycleState": "PUBLISHED",
                "specificContent": {
                    "com.linkedin.ugc.ShareContent": {
                        "shareCommentary": {"text": text},
                        "shareMediaCategory": "NONE"
                    }
                },
                "visibility": {
                    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                }
            }
            response = await client.post(
                f"{self.api_base_url}/ugcPosts",
                json=payload,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "X-Restli-Protocol-Version": "2.0.0",
                    "Content-Type": "application/json"
                }
            )
            response.raise_for_status()
            return response.json()
