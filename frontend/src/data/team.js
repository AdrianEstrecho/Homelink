// The development team shown on /team (and the avatar strip on /about). Everything a member's
// card and profile dialog show comes from here, so filling in a field below is all it takes to
// put it on the page — empty ones (bio, contributions, links, photo) are simply left out.
//
//   slug           used in the shareable link: /team?member=<slug>
//   role           shown on the card; a role filter appears once members have different roles
//   gradient       Tailwind classes for the initials avatar (written out in full so Tailwind keeps them)
//   color          the same accent as a hex, for the card's hover glow
//   photo          optional image URL — replaces the initials avatar when set
//   contributions  short lines on what this member built or did for HomeLink
//   links          optional github / linkedin profile URLs and an email address
export const TEAM = [
  {
    slug: 'adrian-estrecho',
    firstName: 'Adrian',
    lastName: 'Estrecho',
    role: 'Developer',
    gradient: 'from-brand-orange to-amber-400',
    color: '#ff6b35',
    photo: '/team/adrian-estrecho.webp',
    bio: '',
    contributions: [],
    links: { github: '', linkedin: '', email: '' },
  },
  {
    slug: 'bianca-galvez',
    firstName: 'Bianca',
    lastName: 'Galvez',
    role: 'Developer',
    gradient: 'from-brand-teal to-emerald-300',
    color: '#00a896',
    photo: '/team/bianca-galvez.webp',
    bio: '',
    contributions: [],
    links: { github: '', linkedin: '', email: '' },
  },
  {
    slug: 'rhangel-mansilla',
    firstName: 'Rhangel',
    lastName: 'Mansilla',
    role: 'Developer',
    gradient: 'from-brand-blue to-sky-400',
    color: '#38bdf8',
    photo: '/team/rhangel-mansilla.webp',
    bio: '',
    contributions: [],
    links: { github: '', linkedin: '', email: '' },
  },
  {
    slug: 'luigi-natal',
    firstName: 'Luigi',
    lastName: 'Natal',
    role: 'Developer',
    gradient: 'from-rose-500 to-brand-orange',
    color: '#f43f5e',
    photo: '/team/luigi-natal.webp',
    bio: '',
    contributions: [],
    links: { github: '', linkedin: '', email: '' },
  },
  {
    slug: 'aldred-rapacon',
    firstName: 'Aldred',
    lastName: 'Rapacon',
    role: 'Developer',
    gradient: 'from-indigo-500 to-brand-teal',
    color: '#6366f1',
    photo: '/team/aldred-rapacon.webp',
    bio: '',
    contributions: [],
    links: { github: '', linkedin: '', email: '' },
  },
];

export const initialsOf = (m) => `${m.firstName[0]}${m.lastName[0]}`;
export const fullNameOf = (m) => `${m.firstName} ${m.lastName}`;
