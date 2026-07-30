import appdaemon.plugins.hass.hassapi as hass
import re


class PactPilotBackend(hass.Hass):
    """
    AppDaemon backend for the PactPilot Card.

    Stores each contract as a single sensor entity:
      - state: contract status (active, cancelled, pending)
      - attributes: name, category, provider, cost, cycle, next_payment,
                    logo, url, markdown (long details)

    This bypasses Home Assistant's 255-character state limit because the long
    Markdown lives in an attribute.

    Listens for:
      - pactpilot_save   -> creates/updates sensor.pactpilot_<slug>
      - pactpilot_delete -> removes sensor.pactpilot_<slug>
    """

    def initialize(self):
        self.listen_event(self._handle_save, "pactpilot_save")
        self.listen_event(self._handle_delete, "pactpilot_delete")
        self.log("PactPilot backend started")

    def _slugify(self, name):
        return re.sub(
            r"[^a-z0-9]+",
            "_",
            name.lower()
            .replace("ä", "ae")
            .replace("ö", "oe")
            .replace("ü", "ue")
            .replace("ß", "ss"),
        ).strip("_")[:50]

    def _handle_save(self, event_name, data, kwargs):
        name = data.get("name")
        if not name:
            self.log("PactPilot save ignored: no name provided", level="WARNING")
            return

        slug = data.get("slug") or self._slugify(name)
        sensor_id = f"sensor.pactpilot_{slug}"

        # Defense-in-depth: strip HTML from Markdown source.
        details = data.get("details", "")
        safe_details = re.sub(r"<[^>]*>", "", details)

        attributes = {
            "name": name,
            "category": data.get("category", "Sonstiges"),
            "provider": data.get("provider", ""),
            "cost": float(data.get("cost") or 0),
            "cycle": data.get("cycle", "monatlich"),
            "next_payment": data.get("next_payment", ""),
            "logo": data.get("logo", ""),
            "url": data.get("url", ""),
            "markdown": safe_details,
            "friendly_name": f"PactPilot {name}",
        }

        state = data.get("status", "active")
        self.set_state(sensor_id, state=state, attributes=attributes)
        self.log(f"PactPilot contract saved: {sensor_id}")

    def _handle_delete(self, event_name, data, kwargs):
        slug = data.get("slug")
        if not slug:
            self.log("PactPilot delete ignored: no slug provided", level="WARNING")
            return

        sensor_id = f"sensor.pactpilot_{slug}"
        try:
            self.remove_entity(sensor_id)
            self.log(f"PactPilot contract removed: {sensor_id}")
        except Exception as e:
            self.log(f"PactPilot remove failed for {sensor_id}: {e}", level="WARNING")
