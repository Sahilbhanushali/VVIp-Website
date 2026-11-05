/**
 * Single source of truth for business content shared across pages.
 * All copy below is carried over verbatim (or near-verbatim) from the
 * original HTML site so the brand voice stays intact.
 */
import valet from '../assets/images/features/valet.jpg';
import dropOff from '../assets/images/features/drop-off.jpg';
import foyer from '../assets/images/features/foyer.jpg';
import passage from '../assets/images/features/passage.jpg';

import artGallery from '../assets/images/amenities/art-gallery.jpg';
import ventilated from '../assets/images/amenities/ventilated.jpg';
import carLift from '../assets/images/amenities/car-lift.jpg';
import cctv from '../assets/images/amenities/cctv.jpg';
import checkIn from '../assets/images/amenities/check-in.jpg';
import lobby from '../assets/images/amenities/lobby.jpg';
import fireSafety from '../assets/images/amenities/fire-safety.jpg';
import lifts from '../assets/images/amenities/lifts.jpg';
import widePassage from '../assets/images/amenities/wide-passage.jpg';
import security from '../assets/images/amenities/security.jpg';
import podium from '../assets/images/amenities/podium.jpg';

export const site = {
  name: 'VVIP Properties',
  project: 'NeoVista',
  developer: 'Odhav Developers',
  url: 'https://vapisvip.com',
  tagline: 'The Key To Vapi’s VIP Era.',
  address: 'NeoVista, Char Rasta, Near DCB Bank, Vapi Gujarat - 396195',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=NeoVista%2C%20Char%20Rasta%2C%20Vapi',
  mapEmbed:
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d4534.513912030461!2d72.91672785523166!3d20.3687889419132!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be0cf16b18c0ac3%3A0xee1fdc02320b054e!2sNeoVista!5e0!3m2!1sen!2sin!4v1747652827706!5m2!1sen!2sin',
  phones: [
    { label: '+91 968 766 4411', href: 'tel:+919687664411' },
    { label: '+91 968 766 4433', href: 'tel:+919687664433' },
  ],
  emails: [
    { label: 'mail@vapisvip.com', href: 'mailto:mail@vapisvip.com' },
    { label: 'odhavdevelopersgroup@gmail.com', href: 'mailto:odhavdevelopersgroup@gmail.com' },
  ],
  hours: [
    { days: 'Monday – Friday', time: '9:00 – 18:00' },
    { days: 'Saturday', time: '10:00 – 16:00' },
  ],
  socials: [
    { name: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61576362355214', icon: 'facebook' },
    { name: 'Instagram', href: 'https://www.instagram.com/_neo_vista_?igsh=MXhnYXZsODZ1azRjbQ==', icon: 'instagram' },
    { name: 'LinkedIn', href: 'https://www.linkedin.com/company/odhav-developers-groups/', icon: 'linkedin' },
  ],
  credit: 'itsmedigital.in',
} as const;

/** Section anchors. Legacy IDs are kept so old deep links (#about-sec …) still land. */
export const nav = [
  { label: 'Home', href: '/#hero' },
  { label: 'About Us', href: '/#about-sec' },
  { label: 'Properties', href: '/neovista.html' },
  { label: 'Blogs', href: '/#blog-sec' },
  { label: 'Contact Us', href: '/#contact-sec' },
] as const;

export const stats = [
  { value: 26, decimals: 0, suffix: '+', label: 'Years' },
  { value: 4.5, decimals: 1, suffix: '', label: 'Million Sq.Ft' },
  { value: 20, decimals: 0, suffix: '+', label: 'Projects Delivered' },
  { value: 2500, decimals: 0, suffix: '+', label: 'Happy Families' },
] as const;

export const towers = [
  {
    code: 'A',
    kicker: 'Tower A',
    title: 'The Powerhouse of Business',
    text: 'From elite lounges and designer offices to curated retail and sky lounges, this is where the top 1% come to build, grow, and lead. A luxury-first approach to business infrastructure tailored for entrepreneurs and empire builders.',
  },
  {
    code: 'A',
    kicker: 'Tower A',
    title: 'Dedicated Retail Showrooms',
    text: 'A curated space where luxury brands meet discerning buyers in an atmosphere of elegance and exclusivity. More than retail, it’s a statement of prestige.',
  },
  {
    code: 'B',
    kicker: 'Tower B',
    title: 'Vapi’s Most Advanced Healthcare & Hospitality Hub',
    text: 'Tower B is meticulously designed as a future-forward space, ideal for both healthcare and hospitality ventures.',
  },
] as const;

export const signatureFeatures = [
  {
    no: '01',
    subtitle: 'Valet Parking',
    title: 'Because Time is Prestige',
    text: 'NeoVista is the first commercial project in Vapi to offer valet service for both business and hospitality, catering to Vapi’s VIP community.',
    image: valet,
    alt: 'Valet attendant receiving car keys at the NeoVista porte-cochère',
  },
  {
    no: '02',
    subtitle: 'Drop Off',
    title: 'Flow, Function & First Class Access',
    text: 'Thoughtful drop off points ensure seamless navigation for office users, visitors.',
    image: dropOff,
    alt: 'Covered vehicle drop-off bay with timber ceiling and feature lighting',
  },
  {
    no: '03',
    subtitle: 'Double Heighted Foyer',
    title: 'First Impressions, The Royal One!',
    text: 'Bow down to timeless elegance. Where every detail speaks of royalty. NeoVista greets every visitor with grandeur.',
    image: foyer,
    alt: 'Double-height reception foyer with lounge seating and glazed façade',
  },
  {
    no: '04',
    subtitle: 'Passage',
    title: 'A State-Of-The-Art Lobby',
    text: 'With expansive ten foot long gallery displays designed to captivate, inspire, and elevate every impression.',
    image: passage,
    alt: 'Marble lift lobby passage with gallery displays',
  },
] as const;

export const amenities = [
  { name: 'Art Gallery Foyer', icon: 'art-gallery', image: artGallery },
  { name: 'Well Ventilated', icon: 'ventilated', image: ventilated },
  { name: 'Car Lift', icon: 'car-lift', image: carLift },
  { name: 'CCTV', icon: 'cctv', image: cctv },
  { name: 'Check-In Point', icon: 'check-in', image: checkIn },
  { name: 'Entrance Lobby', icon: 'lobby', image: lobby },
  { name: 'Fire Extinguisher', icon: 'fire-safety', image: fireSafety },
  { name: 'Lifts', icon: 'lifts', image: lifts },
  { name: 'Wide Passage', icon: 'wide-passage', image: widePassage },
  { name: 'Security', icon: 'security', image: security },
  { name: 'Podium', icon: 'podium', image: podium },
] as const;

/** Options offered by the original "Schedule a visit" forms (values are sent to mail.php). */
export const enquiryTypes = ['Real Estate', 'Apartment', 'Residencial', 'Showrooms', 'Offices', 'Deluxe'] as const;

/* ------------------------------------------------------------------ */
/* Property facts — every value below comes from existing site copy.   */
/* ------------------------------------------------------------------ */
import towersImg from '../assets/images/neovista-towers.jpg';
import facadeImg from '../assets/images/neovista-facade.jpg';
import showroomImg from '../assets/images/showroom-space.jpg';
import sayYes1 from '../assets/images/campaign/say-yes-01.jpg';
import sayYes3 from '../assets/images/campaign/say-yes-03.jpg';

export const property = {
  name: 'NeoVista',
  developer: 'Odhav Developers',
  location: 'Char Rasta, Vapi, Gujarat',
  category: 'All-commercial · RERA-registered',
  spaces: ['Designer offices', 'Retail showrooms', 'Healthcare', 'Hospitality'],
  price: 'Price on request',
  facts: [
    { label: 'Developer', value: 'Odhav Developers' },
    { label: 'Location', value: 'Char Rasta, Vapi' },
    { label: 'Project type', value: 'All-commercial' },
    { label: 'Registration', value: 'RERA-registered' },
    { label: 'Towers', value: 'Twin towers — A & B' },
    { label: 'Pricing', value: 'On request' },
  ],
} as const;

export const towerViews = [
  { ...towers[0], image: towersImg, position: '58% 40%', tags: ['Designer offices', 'Elite lounges', 'Sky lounges'] },
  { ...towers[1], image: showroomImg, position: '50% 100%', tags: ['High-frontage retail', 'Luxury brands', 'Street presence'] },
  { ...towers[2], image: facadeImg, position: '78% 50%', tags: ['Healthcare-ready', 'Hospitality', 'Dedicated tower'] },
] as const;

export type GalleryCategory = 'Architecture' | 'Arrival' | 'Interiors' | 'Campaign';
export const galleryCategories: GalleryCategory[] = ['Architecture', 'Arrival', 'Interiors', 'Campaign'];

export const gallery = [
  { image: towersImg, title: 'NeoVista twin towers', category: 'Architecture', shape: 'wide' },
  { image: valet, title: 'Valet arrival', category: 'Arrival', shape: 'tall' },
  { image: facadeImg, title: 'Façade & podium', category: 'Architecture', shape: 'std' },
  { image: foyer, title: 'Double-height foyer', category: 'Interiors', shape: 'std' },
  { image: showroomImg, title: 'Tower A retail showrooms', category: 'Architecture', shape: 'wide' },
  { image: lobby, title: 'Entrance lobby', category: 'Interiors', shape: 'tall' },
  { image: dropOff, title: 'Drop-off bay', category: 'Arrival', shape: 'std' },
  { image: passage, title: 'Lift lobby passage', category: 'Interiors', shape: 'std' },
  { image: sayYes1, title: 'VVIPs, it’s time to Say Yes', category: 'Campaign', shape: 'wide' },
  { image: sayYes3, title: 'The VIP lounge', category: 'Campaign', shape: 'wide' },
] as const satisfies ReadonlyArray<{ image: ImageMetadata; title: string; category: GalleryCategory; shape: 'wide' | 'tall' | 'std' }>;

export const connectivity = [
  { title: 'Char Rasta junction', text: 'One of the city’s key junctions, linking the GIDC industrial estate, residential neighbourhoods and the wider regional road network.' },
  { title: 'Mumbai & Surat', text: 'Located midway between these two economic powerhouses — just 2–3 hours from each.' },
  { title: 'Expressway network', text: 'Quick reach of National/State highways and the expressway network connecting Vapi to Mumbai, Surat and Vadodara.' },
  { title: 'High-speed rail', text: 'The upcoming Mumbai–Ahmedabad bullet train corridor is expected to compress business travel times.' },
  { title: 'Daman airport', text: 'Regional air connectivity for executives and visitors through the Daman airport project.' },
  { title: 'Everyday convenience', text: 'Five-minute access to premium retail and dining, hospitals, banks and business centres.' },
] as const;

export const faqs = [
  { q: 'Where is NeoVista located?', a: 'NeoVista is at Char Rasta, near DCB Bank, Vapi, Gujarat — 396195. Char Rasta is one of Vapi’s key junctions, linking GIDC, residential neighbourhoods and the regional road network.' },
  { q: 'What kind of spaces are available?', a: 'NeoVista is an all-commercial, twin-tower project. Tower A houses designer offices, elite lounges and dedicated retail showrooms; Tower B is designed for healthcare and hospitality ventures.' },
  { q: 'Is the project RERA-registered?', a: 'Yes. NeoVista is a RERA-registered, all-commercial project at Vapi.' },
  { q: 'Who is the developer?', a: 'NeoVista is developed by Odhav Developers, who have over 26 years of experience in South Gujarat, 20+ projects delivered and 2,500+ happy families.' },
  { q: 'What amenities does NeoVista offer?', a: 'Valet parking, thoughtful drop-off points, a double-height foyer, an art gallery foyer, car lift, CCTV, check-in point, fire safety systems, lifts, wide passages, 24/7 security and a podium.' },
  { q: 'How can I schedule a site visit?', a: 'Use the “Schedule a visit” form, call +91 968 766 4411, or visit us Monday–Friday 9:00–18:00 and Saturday 10:00–16:00. Pricing is shared on request.' },
] as const;
