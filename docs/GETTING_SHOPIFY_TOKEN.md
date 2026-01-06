Using the client credentials grant

Copy page MD

The client credentials grant is an OAuth 2.0 flow where your app exchanges its own client ID and client secret directly with a store in which it's installed to obtain an access token, without any end-user interaction (RFC 6749, section 
4.4
). Use this for trusted, server-to-server integrations owned by your organization (for example, internal automation or back-office services).

Client credentials is only available for apps developed by your own organization and installed in stores that you own. Public or custom apps must use token exchange or authorization code. This tutorial shows you how to manually implement the client credentials grant type to acquire an access token for your app.

Requirements
You've configured access scopes for your app. Access scopes can be configured either in the Dev Dashboard when creating an app version or in your app's TOML configuration file
You've installed your app into a store. You need to acquire an access token for each store in which the app is installed.
Step 1: Get your client credentials from the Dev Dashboard
Your app's client credentials are on the Settings page. You'll need the Client ID and Secret to authenticate your app.

Caution
The client secret is sensitive information. Don't expose it in your app's frontend code or in your code repositories. If you suspect that your client secret has been compromised, you must rotate it immediately.

Step 2: Get an access token
To get an access token, your app needs to make a request to the token endpoint with the client credentials.

Build a URL using the following format and parameters:

Copy
1
POST https://{shop}.myshopify.com/admin/oauth/access_token
Send a request to this endpoint with the following parameters in the request body:

Parameter	Description
client_id	The client ID for the app.
client_secret	The client secret for the app.
grant_type	This must always be set to client_credentials.
Example
The following shows an example of a client credential request.

Request
Copy
$
$
$
$
$
$
curl -X POST \
  "https://{shop}.myshopify.com/admin/oauth/access_token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id={client_id}" \
  -d "client_secret={client_secret}"
Response
Copy
1
2
3
4
5
{
  "access_token": "f85632530bf277ec9ac6f649fc327f17",
  "scope": "write_orders,read_customers",
  "expires_in": 86399
}
Offline access token response values
Value	Description
access_token	An API access token that can be used to access the shop’s data as long as your app is installed. Your app should store the token somewhere to make authenticated requests for a shop’s data.
scope	The list of access scopes that were granted to your app and are associated with the access token.
expires_in	The number of seconds until the access token expires. This is always set to 86399 (24 hours).
Step 3: Refresh the access token
After your app has obtained an API access token, it can make authenticated requests to the GraphQL Admin API. Access tokens are valid for 24 hours, after which they must be refreshed. To refresh the access token your app must make the same request to the token endpoint with the client credentials as in the previous step.