export interface Sector {
  mult: number;
  bg: string;
  ac: string;
  icon: string;
  weight: number;
}

export const SEGS: Sector[] = [
  {mult:45, bg:'#5e0e0e', ac:'#e74c3c', icon:'/assets/trophy.png', weight: 20},
  {mult:5,  bg:'#0a2e50', ac:'#3498db', icon:'/assets/car_red.png', weight: 197},
  {mult:15, bg:'#0a3e18', ac:'#2ecc71', icon:'/assets/car_race.png', weight: 60},
  {mult:5,  bg:'#4a2806', ac:'#f39c12', icon:'/assets/car_blue.png', weight: 197},
  {mult:25, bg:'#350d60', ac:'#9b59b6', icon:'/assets/medal_gold.png', weight: 35},
  {mult:5,  bg:'#083636', ac:'#1abc9c', icon:'/assets/car_yellow.png', weight: 197},
  {mult:10, bg:'#520c0c', ac:'#ff6b6b', icon:'/assets/target.png', weight: 97},
  {mult:5,  bg:'#27125a', ac:'#8e44ad', icon:'/assets/car_red.png', weight: 197},
];

export const N = 8;
export const SDG = 360 / N;

export const getRandomSectorIndex = (): number => {
  const totalWeight = SEGS.reduce((acc, curr) => acc + curr.weight, 0);
  let random = Math.random() * totalWeight;
  for (let i = 0; i < SEGS.length; i++) {
    random -= SEGS[i].weight;
    if (random <= 0) return i;
  }
  return SEGS.length - 1;
};

export const fmt = (n: number) => {
  if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'K';
  return Math.round(n).toLocaleString();
};

export const preloadImages = (): Promise<Record<string, HTMLImageElement>> => {
  return new Promise((resolve) => {
    const images: Record<string, HTMLImageElement> = {};
    const uniquePaths = [...new Set(SEGS.map(s => s.icon))];
    let loaded = 0;
    uniquePaths.forEach(path => {
      const img = new Image();
      img.onload = () => {
        images[path] = img;
        loaded++;
        if (loaded === uniquePaths.length) resolve(images);
      };
      img.src = path;
    });
  });
};
