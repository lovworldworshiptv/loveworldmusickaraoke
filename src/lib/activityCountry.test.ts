import { describe, expect, it } from "vitest";
import { countryFromTimezone, countryName, parseTraceCountry } from "./activityCountry";

describe("activity country", () => {
  it("reads the country from the network trace", () => {
    expect(parseTraceCountry("fl=1\nip=1.2.3.4\nloc=NG\ntls=TLSv1.3\n")).toBe("NG");
  });

  it("ignores unknown or Tor countries", () => {
    expect(parseTraceCountry("loc=XX\n")).toBeNull();
    expect(parseTraceCountry("loc=T1\n")).toBeNull();
    expect(parseTraceCountry("<!doctype html><html>")).toBeNull();
  });

  it("falls back to the device time zone", async () => {
    expect(await countryFromTimezone("Africa/Lagos")).toBe("NG");
    expect(await countryFromTimezone("Africa/Douala")).toBe("CM");
    expect(await countryFromTimezone("Europe/London")).toBe("GB");
    expect(await countryFromTimezone("Mars/Base")).toBeNull();
  });

  it("names countries in English", () => {
    expect(countryName("NG")).toBe("Nigeria");
  });
});
