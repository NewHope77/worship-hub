import type { AppData, Member, Song } from '../types'

const MEMBERS: Member[] = [
  { id: 'm_keys',  name: 'Клавішниця',    instruments: ['keys', 'vocal'], isLeader: true,  color: 'from-violet-500 to-fuchsia-500' },
  { id: 'm_agtr',  name: 'Акустика',      instruments: ['agtr', 'vocal'], isLeader: false, color: 'from-amber-500 to-orange-500' },
  { id: 'm_vocal', name: 'Вокалістка',    instruments: ['vocal'],         isLeader: false, color: 'from-rose-500 to-pink-500' },
  { id: 'm_egtr',  name: 'Електрогітара', instruments: ['egtr'],          isLeader: false, color: 'from-sky-500 to-cyan-500' },
  { id: 'm_bass',  name: 'Бас',           instruments: ['bass'],          isLeader: false, color: 'from-emerald-500 to-teal-500' },
  { id: 'm_drums', name: 'Барабани',      instruments: ['drums'],         isLeader: false, color: 'from-slate-400 to-slate-600' },
]

function song(s: Omit<Song, 'updatedAt' | 'createdBy'>): Song {
  return { ...s, createdBy: 'm_keys', updatedAt: Date.now() }
}

const SONGS: Song[] = [
  song({
    id: 'sg_demo',
    title: 'Як це працює (демо)',
    author: 'Worship Hub',
    originalKey: 'G',
    tempo: 72,
    timeSignature: '4/4',
    tags: ['демо'],
    youtubeUrl: '',
    notes: 'Це навчальна пісня. Видали її, коли розберешся.',
    sections: [
      { id: 'sg_demo_1', kind: 'intro', label: 'Вступ', body: '[G] [D] [Em] [C]' },
      { id: 'sg_demo_2', kind: 'verse', label: 'Куплет 1', body:
        'Акорд пишеться в [G]квадратних дужках перед складом,\n' +
        'на якому він [D]береться — і стає над ним.\n' +
        'Вокалісти [Em]бачать тільки текст,\n' +
        'а бас і барабани — [C]сітку акордів.' },
      { id: 'sg_demo_3', kind: 'chorus', label: 'Приспів', body:
        'Тисни [C]«−» або «+» вгорі —\n' +
        'акорди [G]перебудуються в твою [D]тональність,\n' +
        'і тільки в [Em]твою: в інших залишиться своя.' },
      { id: 'sg_demo_4', kind: 'bridge', label: 'Міст', body:
        'Секції можна [Am]тягнути й міняти [F]місцями\n' +
        'під конкретне [C]служіння.' },
    ],
    arrangement: ['sg_demo_1', 'sg_demo_2', 'sg_demo_3', 'sg_demo_4', 'sg_demo_3'],
  }),
  song({
    id: 'sg_svyat',
    title: 'Свят, свят, свят',
    author: 'Reginald Heber, 1826 (традиційний)',
    originalKey: 'D',
    tempo: 84,
    timeSignature: '4/4',
    tags: ['гімн', 'поклоніння'],
    youtubeUrl: '',
    notes: '',
    sections: [
      { id: 'sg_svyat_1', kind: 'verse', label: 'Куплет 1', body:
        '[D]Свят, свят, свят, [G]Господь Бог [D]Всемогутній!\n' +
        '[D]Вранці [A]рано пісня [D]лине [A]до Тебе.\n' +
        '[D]Свят, свят, свят, [G]милостивий і [D]сильний,\n' +
        '[G]Бог у [D]трьох Особах, [A7]благословен [D]навік.' },
      { id: 'sg_svyat_2', kind: 'verse', label: 'Куплет 2', body:
        '[D]Свят, свят, свят! [G]Всі святі Тебе [D]славлять,\n' +
        '[D]Склавши [A]вінці свої [D]перед [A]Тобою.\n' +
        '[D]Херувими й [G]серафими [D]поклоняються,\n' +
        '[G]Ти, що [D]був, і є, і [A7]будеш [D]повік.' },
    ],
    arrangement: ['sg_svyat_1', 'sg_svyat_2'],
  }),
]

export function seedData(): AppData {
  return {
    members: MEMBERS,
    songs: SONGS,
    setlists: [],
    personal: [],
    prefs: {},
  }
}
