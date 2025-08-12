import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts'

interface ScoreChartProps {
  checks: Array<{
    id: string
    score: number
  }>
}

export default function ScoreChart({ checks }: ScoreChartProps) {
  const getCategoryName = (id: string) => {
    const names: Record<string, string> = {
      speed: '속도',
      firstView: '퍼스트뷰',
      bi: 'BI',
      navigation: '내비',
      uspPromo: 'USP',
      visuals: '비주얼',
      trust: '신뢰',
      mobile: '모바일',
      purchaseFlow: '구매',
      seoAnalytics: 'SEO'
    }
    return names[id] || id
  }

  const data = checks.map(check => ({
    category: getCategoryName(check.id),
    score: check.score,
    fullMark: 10
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid 
          gridType="polygon" 
          radialLines={false}
          stroke="#e5e7eb"
        />
        <PolarAngleAxis 
          dataKey="category" 
          tick={{ fontSize: 12, fill: '#6b7280' }}
        />
        <PolarRadiusAxis 
          domain={[0, 10]} 
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          axisLine={false}
        />
        <Radar 
          name="점수" 
          dataKey="score" 
          stroke="#3b82f6" 
          fill="#3b82f6" 
          fillOpacity={0.5}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}