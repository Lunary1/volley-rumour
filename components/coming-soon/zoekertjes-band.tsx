import { ClassifiedTypeLabel } from "@/components/classified-type-label";
import {
  DIVISION_LABELS,
  POSITION_LABELS,
  PROVINCE_LABELS,
  TRAINER_DIPLOMA_LABELS,
} from "@/lib/classifieds-utils";

// A band of the kinds of zoekertje the site will carry (#236), built from the
// real labels. Examples only: no person or club is named. It stands still
// (#240): a band that slides by itself needs a pause control (WCAG 2.2.2), and
// a hover pause is no use on a phone. On a phone the visitor swipes it; from
// lg it wraps.
const EXAMPLES = [
  {
    type: "team_seeks_player",
    detail: [POSITION_LABELS.libero, DIVISION_LABELS.nat2_dames],
    province: PROVINCE_LABELS.limburg,
  },
  {
    type: "player_seeks_team",
    detail: [POSITION_LABELS.setter, DIVISION_LABELS.promo1_heren],
    province: PROVINCE_LABELS.antwerpen,
  },
  {
    type: "team_seeks_trainer",
    detail: [TRAINER_DIPLOMA_LABELS.trainer_b, DIVISION_LABELS.nat3_heren],
    province: PROVINCE_LABELS.oost_vlaanderen,
  },
  {
    type: "player_seeks_team",
    detail: [POSITION_LABELS.middenaanvaller, DIVISION_LABELS.nat1_dames],
    province: PROVINCE_LABELS.west_vlaanderen,
  },
  {
    type: "team_seeks_player",
    detail: [POSITION_LABELS.opposite, DIVISION_LABELS.promo2_heren],
    province: PROVINCE_LABELS.vlaams_brabant,
  },
  {
    type: "trainer_seeks_team",
    detail: [TRAINER_DIPLOMA_LABELS.trainer_c, DIVISION_LABELS.promo3_dames],
    province: PROVINCE_LABELS.antwerpen,
  },
  {
    type: "team_seeks_player",
    detail: [POSITION_LABELS.receptiehoek, DIVISION_LABELS.promo1_dames],
    province: PROVINCE_LABELS.oost_vlaanderen,
  },
] as const;

export function ZoekertjesBand() {
  return (
    <section
      aria-label="Voorbeelden van zoekertjes"
      className="border-b border-border py-4"
    >
      {/* Focusable, so a keyboard can scroll it too. */}
      <ul
        tabIndex={0}
        className="mx-auto flex max-w-7xl snap-x gap-3 overflow-x-auto px-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-6 lg:flex-wrap lg:justify-center lg:overflow-visible lg:px-8"
      >
        {EXAMPLES.map((ad, i) => (
          <li
            key={i}
            className="flex shrink-0 snap-start items-center gap-2.5 rounded-full border border-border bg-card py-1.5 pr-4 pl-1.5 text-meta whitespace-nowrap"
          >
            <ClassifiedTypeLabel type={ad.type} />
            <span className="font-medium text-foreground">
              {ad.detail.join(" · ")}
            </span>
            <span className="text-muted-foreground">{ad.province}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
