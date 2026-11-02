import http from "k6/http"
import { check, sleep } from "k6"

const SITE_URL = __ENV.SITE_URL || "http://crs-17313-2hdmi.qatar.cmu.edu"

export const options = {
  vus: 5,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
  },
}

export default function () {
  const home = http.get(`${SITE_URL}/`)
  check(home, {
    "home page returns 200": (res) => res.status === 200,
  })
  sleep(1)
}
