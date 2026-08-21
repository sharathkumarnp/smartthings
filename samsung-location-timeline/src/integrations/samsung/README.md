# Samsung provider feasibility

This integration uses only the official SmartThings REST API. It lists devices granted by the account owner and reads the documented `geolocation` capability when a device exposes it.

Samsung does not document a general public API for retrieving a Galaxy phone's Samsung Find / Find My Mobile coordinates. A phone may appear in Samsung Find yet be absent from SmartThings REST, or appear without `geolocation`. In that case this provider returns `LOCATION_UNSUPPORTED`; it does not scrape Samsung web pages, copy browser cookies, bypass MFA/CAPTCHA, or call undocumented endpoints.

Run `npm run poc:samsung` first with `SMARTTHINGS_ACCESS_TOKEN`. The first run lists authorized devices. Set `SAMSUNG_DEVICE_ID` and run again for normalized JSON. Treat success as account/device-specific, then monitor reliability and token expiry before selecting `LOCATION_PROVIDER=samsung`.
