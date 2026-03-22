#!/usr/bin/env python3
"""
ONE-TIME SCRIPT — run locally to authorize IT Buddy to access admin@lm-intel.ai.

Steps:
  1. pip install google-auth-oauthlib
  2. Fill in CLIENT_ID and CLIENT_SECRET from Google Cloud Console
     (Credentials → OAuth 2.0 Client IDs → Download JSON)
  3. python get_gmail_token.py
  4. A browser window opens — sign in as admin@lm-intel.ai and click Allow
  5. Copy the three values printed at the end into Railway environment variables
  6. Delete this file after use
"""

from google_auth_oauthlib.flow import InstalledAppFlow

CLIENT_ID     = 'YOUR_GOOGLE_OAUTH_CLIENT_ID'
CLIENT_SECRET = 'YOUR_GOOGLE_OAUTH_CLIENT_SECRET'

SCOPES = [
    'https://www.googleapis.com/auth/gmail.modify',  # read emails + mark as read / label
    'https://www.googleapis.com/auth/gmail.send',    # send reply emails
]

client_config = {
    'installed': {
        'client_id':     CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'auth_uri':      'https://accounts.google.com/o/oauth2/auth',
        'token_uri':     'https://oauth2.googleapis.com/token',
        'redirect_uris': ['urn:ietf:wg:oauth:2.0:oob', 'http://localhost'],
    }
}

flow  = InstalledAppFlow.from_client_config(client_config, SCOPES)
creds = flow.run_local_server(port=0)

print()
print('=' * 60)
print('Add these three values to Railway environment variables:')
print('=' * 60)
print(f'GMAIL_CLIENT_ID     = {CLIENT_ID}')
print(f'GMAIL_CLIENT_SECRET = {CLIENT_SECRET}')
print(f'GMAIL_REFRESH_TOKEN = {creds.refresh_token}')
print('=' * 60)
print()
print('Delete this file after copying the values above.')
