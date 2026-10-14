import json
import streamlit as st
from compare_oas_payloads import compare
st.title("Semester: OAS 3.0 / 3.1 payload comparison")
st.warning("Use synthetic or institution-approved minimized fixtures. Local payload-schema tool, not production API certification.")
payload=st.text_area("JSON payload",'{"receiptId": null}')
left,right=st.columns(2)
s30=left.text_area("OpenAPI 3.0 Schema Object",'{"type":"object","required":["receiptId"],"properties":{"receiptId":{"type":"string","nullable":true}},"additionalProperties":false}')
s31=right.text_area("OpenAPI 3.1 Schema Object",'{"type":"object","required":["receiptId"],"properties":{"receiptId":{"type":["string","null"]}},"additionalProperties":false}')
if st.button("Validate side by side"):
    try:
        report=compare(json.loads(payload),json.loads(s30),json.loads(s31))
        left.json(report["3.0"]);right.json(report["3.1"])
        st.download_button("Export sanitized report",json.dumps(report,indent=2),"comparison-report.json","application/json")
    except Exception as exc: st.error("Blocked: "+type(exc).__name__)
