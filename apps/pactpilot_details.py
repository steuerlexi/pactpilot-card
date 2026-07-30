import appdaemon.plugins.hass.hassapi as hass
import re


class PactPilotDetails(hass.Hass):
    """
    AppDaemon helper for the PactPilot Card.

    Stores long Markdown contract details in a sensor attribute, bypassing
    Home Assistant's 255-character state limit.

    Listens for:
      - pactpilot_details_save   -> creates/updates sensor.pactpilot_<slug>_details
      - pactpilot_details_delete -> removes the matching details sensor
    """

    def initialize(self):
        self.listen_event(self._handle_save, "pactpilot_details_save")
        self.listen_event(self._handle_delete, "pactpilot_details_delete")
        self.log("PactPilot details backend started")

    def _handle_save(self, event_name, data, kwargs):
        slug = data.get("slug")
        details = data.get("details", "")
        contract_entity = data.get("entity_id", f"input_text.pactpilot_{slug}")

        if not slug:
            self.log("PactPilot details save ignored: no slug provided", level="WARNING")
            return

        sensor_id = f"sensor.pactpilot_{slug}_details"

        # Strip HTML from source as defense-in-depth.
        safe_details = re.sub(r"<[^>]*>", "", details)

        self.set_state(
            sensor_id,
            state="OK",
            attributes={
                "markdown": safe_details,
                "contract_entity": contract_entity,
                "friendly_name": f"PactPilot {slug} details",
            },
        )
        self.log(f"PactPilot details updated: {sensor_id}")

    def _handle_delete(self, event_name, data, kwargs):
        slug = data.get("slug")
        if not slug:
            self.log("PactPilot details delete ignored: no slug provided", level="WARNING")
            return

        sensor_id = f"sensor.pactpilot_{slug}_details"
        try:
            self.remove_entity(sensor_id)
            self.log(f"PactPilot details removed: {sensor_id}")
        except Exception as e:
            self.log(f"PactPilot details remove failed for {sensor_id}: {e}", level="WARNING")
