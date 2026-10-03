import { Placeholder } from "./placeholder";

// One page per primary section (blueprint §2.1). Copy follows functionality §3.x; each is replaced in Phase 5.

export const ExplorePage = () => (
  <Placeholder
    title="Explore"
    intro="Church and priest profiles, events and educational content from churches, priests and approved creators."
    coming="Browsing and moderated authoring arrive in Phase 5.7."
  />
);

export const PodcastsPage = () => (
  <Placeholder
    title="Podcasts"
    intro="Catholic podcast series and episodes — stream, browse and follow."
    coming="The podcast library and player arrive in Phase 5.5."
  />
);

export const TeachingsPage = () => (
  <Placeholder
    title="Teachings"
    intro="Catechesis on the sacraments, morality, prayer, liturgy, Church history and more."
    coming="Topic browsing and lessons arrive in Phase 5.6."
  />
);

// More-menu destinations (functionality §3.9)
export const SubscribePage = () => (
  <Placeholder
    title="Subscribe your church"
    intro="Unlock Church Management for your parish and its outstations: members, societies, messaging and more."
    coming="Plans (Basic, Premium, Ultimate) and trials arrive with the CMS in Phase 4."
  />
);

export const CmsLoginPage = () => (
  <Placeholder
    title="Church Management login"
    intro="Staff of subscribed churches sign in to the Church Management application here."
    coming="The CMS opens in Phase 4."
  />
);

export const NotificationsPage = () => (
  <Placeholder
    title="Notifications"
    intro="New content, events and messages from your church and societies."
    coming="Notifications arrive in Phase 6."
  />
);

export const AboutPage = () => (
  <Placeholder
    title="About Ecclesios"
    intro="A social platform for the Catholic Church, with an integrated Church Management application."
    coming="Full about page to follow."
  />
);

export const PrivacyPage = () => (
  <Placeholder
    title="Privacy"
    intro="How Ecclesios collects and protects personal data."
    coming="The privacy notice will be published before launch (Phase 10)."
  />
);

export const TermsPage = () => (
  <Placeholder
    title="Terms of use"
    intro="The terms for using Ecclesios."
    coming="The terms will be published before launch (Phase 10)."
  />
);
