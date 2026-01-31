import HeroClient from '@/src/components/HeroClient'
import CuteBackgroundDecor from '@/src/components/CuteBackgroundDecor'

export default function Home(){
  const her = process.env.HER_NAME || 'Love'
  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-8">
      <CuteBackgroundDecor photoCount={6} />
      <div className="relative z-10">
        <HeroClient her={her} />
      </div>
    </div>
  )
}
