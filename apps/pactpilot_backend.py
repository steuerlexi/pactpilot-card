import appdaemon.plugins.hass.hassapi as hass
import json
import os
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

    Persistency:
      - All contracts are stored in /config/appdaemon_data/pactpilot/contracts.json
      - On initialize() every saved contract is re-published via set_state so
        the sensors survive AppDaemon/HA restarts.
    """

    def initialize(self):
        # Optional config override: data_dir in apps.yaml
        self._data_dir = self.args.get("data_dir", "/config/appdaemon_data/pactpilot")
        self._contracts_file = os.path.join(self._data_dir, "contracts.json")
        self._ensure_data_dir()

        self.listen_event(self._handle_save, "pactpilot_save")
        self.listen_event(self._handle_delete, "pactpilot_delete")

        # Re-publish every known contract after a restart. AppDaemon set_state
        # entities disappear when AppDaemon restarts; this restores them.
        self._publish_all()

        # One-shot migration of legacy input_text.pactpilot_* helpers that were
        # created by the v1.x card. They are converted to the backend's JSON
        # store and published as sensors.
        self._migrate_legacy_helpers()

        self.log("PactPilot backend started")

    def _ensure_data_dir(self):
        if not os.path.isdir(self._data_dir):
            try:
                os.makedirs(self._data_dir, exist_ok=True)
            except Exception as e:
                self.log(f"PactPilot data dir creation failed: {e}", level="ERROR")

    def _load_contracts(self):
        try:
            if os.path.exists(self._contracts_file):
                with open(self._contracts_file, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception as e:
            self.log(f"PactPilot load failed: {e}", level="ERROR")
        return {}

    def _save_contracts(self, contracts):
        try:
            with open(self._contracts_file, "w", encoding="utf-8") as f:
                json.dump(contracts, f, ensure_ascii=False, indent=2)
        except Exception as e:
            self.log(f"PactPilot store failed: {e}", level="ERROR")

    def _publish_all(self):
        contracts = self._load_contracts()
        for slug, data in contracts.items():
            sensor_id = f"sensor.pactpilot_{slug}"
            try:
                self._set_sensor(sensor_id, data)
                self.log(f"PactPilot republished: {sensor_id}")
            except Exception as e:
                self.log(f"PactPilot republish failed for {sensor_id}: {e}", level="WARNING")
        if contracts:
            self.log(f"PactPilot republished {len(contracts)} contract(s)")

    def _set_sensor(self, sensor_id, data):
        """Publish a single contract to HA as a sensor."""
        # Defense-in-depth: strip HTML from Markdown source.
        details = data.get("details", "")
        safe_details = re.sub(r"<[^>]*>", "", details)

        attributes = {
            "name": data.get("name", ""),
            "category": data.get("category", "Sonstiges"),
            "provider": data.get("provider", ""),
            "owner": data.get("owner", ""),
            "customer_number": data.get("customer_number", ""),
            "insurance_number": data.get("insurance_number", ""),
            "contract_end": data.get("contract_end", ""),
            "cancellation_period": data.get("cancellation_period", "none"),
            "cost": float(data.get("cost") or 0),
            "cycle": data.get("cycle", "monatlich"),
            "next_payment": data.get("next_payment", ""),
            "logo": data.get("logo", ""),
            "url": data.get("url", ""),
            "markdown": safe_details,
            "friendly_name": f"PactPilot {data.get('name', '')}",
        }

        state = data.get("status", "active")
        self.set_state(sensor_id, state=state, attributes=attributes)

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

        # Update persistent store.
        contracts = self._load_contracts()
        contracts[slug] = {
            "name": name,
            "category": data.get("category", "Sonstiges"),
            "provider": data.get("provider", ""),
            "owner": data.get("owner", ""),
            "customer_number": data.get("customer_number", ""),
            "insurance_number": data.get("insurance_number", ""),
            "contract_end": data.get("contract_end", ""),
            "cancellation_period": data.get("cancellation_period", "none"),
            "cost": data.get("cost", 0),
            "cycle": data.get("cycle", "monatlich"),
            "next_payment": data.get("next_payment", ""),
            "logo": data.get("logo", ""),
            "url": data.get("url", ""),
            "details": data.get("details", ""),
            "status": data.get("status", "active"),
        }
        self._save_contracts(contracts)

        # Publish to HA.
        self._set_sensor(sensor_id, contracts[slug])
        self.log(f"PactPilot contract saved: {sensor_id}")

    def _handle_delete(self, event_name, data, kwargs):
        slug = data.get("slug")
        if not slug:
            self.log("PactPilot delete ignored: no slug provided", level="WARNING")
            return

        sensor_id = f"sensor.pactpilot_{slug}"

        # Remove from persistent store.
        contracts = self._load_contracts()
        if slug in contracts:
            del contracts[slug]
            self._save_contracts(contracts)
            self.log(f"PactPilot contract removed from store: {slug}")

        try:
            self.remove_entity(sensor_id)
            self.log(f"PactPilot contract removed: {sensor_id}")
        except Exception as e:
            self.log(f"PactPilot remove failed for {sensor_id}: {e}", level="WARNING")

    def _migrate_legacy_helpers(self):
        """Convert v1.x input_text.pactpilot_* helpers into backend-managed sensors.

        Reads the YAML state of every input_text.pactpilot_* entity, stores it
        in the backend JSON, publishes a sensor, and then removes the helper.
        """
        try:
            states = self.get_state()
        except Exception as e:
            self.log(f"PactPilot migration: could not read states: {e}", level="WARNING")
            return

        contracts = self._load_contracts()
        migrated = 0
        skipped = 0
        removed = 0

        for entity_id, state_obj in states.items():
            if not entity_id.startswith("input_text.pactpilot_"):
                continue
            # Skip detail-chunk helpers from the old chunked storage scheme.
            if entity_id.endswith("_details_") or re.search(r"_details_\d+$", entity_id):
                continue

            yaml_text = state_obj.get("state", "") if isinstance(state_obj, dict) else ""
            data = self._parse_simple_yaml(yaml_text)
            if not data or not data.get("name"):
                self.log(f"PactPilot migration skipped {entity_id}: no parseable YAML")
                skipped += 1
                continue

            slug = self._slugify(data.get("name"))
            if slug in contracts:
                self.log(f"PactPilot migration skipped {entity_id}: slug '{slug}' already exists")
                skipped += 1
                continue

            contracts[slug] = {
                "name": data.get("name"),
                "category": data.get("category", "Sonstiges"),
                "provider": data.get("provider", ""),
                "owner": data.get("owner", ""),
                "cost": data.get("cost", 0),
                "cycle": data.get("cycle", "monatlich"),
                "next_payment": data.get("next_payment", ""),
                "logo": data.get("logo", ""),
                "url": data.get("url", ""),
                "details": data.get("details", ""),
                "status": data.get("status", "active"),
            }
            migrated += 1
            self.log(f"PactPilot migrated legacy helper {entity_id} -> sensor.pactpilot_{slug}")

            # Remove the old helper so it won't be migrated again.
            try:
                self.remove_entity(entity_id)
                removed += 1
            except Exception as e:
                self.log(f"PactPilot migration could not remove {entity_id}: {e}", level="WARNING")

        if migrated:
            self._save_contracts(contracts)
            self._publish_all()
            self.log(
                f"PactPilot migration done: {migrated} migrated, {skipped} skipped, "
                f"{removed} helpers removed"
            )
        else:
            self.log("PactPilot migration: no legacy input_text helpers found")

    def _parse_simple_yaml(self, text):
        """Minimal YAML parser for the flat PactPilot v1 format.

        Supports:
          - key: value
          - key: "value"
          - key: |
              multiline
              value
        Does not support nested structures or lists.
        """
        if not text or not isinstance(text, str):
            return None
        result = {}
        lines = text.splitlines()
        current_key = None
        multi_lines = []
        in_multiline = False

        for line in lines:
            if in_multiline:
                # Indent is required for continuation lines.
                if line.startswith("  ") or line.startswith("\t") or line == "":
                    # Strip exactly two leading spaces; keep empty lines as-is.
                    stripped = line[2:] if line.startswith("  ") else line
                    multi_lines.append(stripped)
                    continue
                else:
                    result[current_key] = "\n".join(multi_lines).strip()
                    multi_lines = []
                    in_multiline = False
                    current_key = None

            if line.strip() == "" or line.strip().startswith("#"):
                continue
            colon_idx = line.find(":")
            if colon_idx <= 0:
                continue
            key = line[:colon_idx].strip()
            value = line[colon_idx + 1:].strip()
            if value in ("|", "|-", ">"):
                current_key = key
                multi_lines = []
                in_multiline = True
            else:
                # Strip matching quotes.
                if (value.startswith('"') and value.endswith('"')) or (
                    value.startswith("'") and value.endswith("'")
                ):
                    value = value[1:-1]
                # Numeric coercion for cost.
                if key == "cost":
                    try:
                        value = float(value)
                    except (TypeError, ValueError):
                        value = 0
                result[key] = value

        if in_multiline and current_key is not None:
            result[current_key] = "\n".join(multi_lines).strip()

        return result if result.get("name") else None
