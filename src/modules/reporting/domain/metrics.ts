export type MetricUnit = 'count' | 'currency' | 'percentage' | 'days' | 'hours';

export type MetricValue = Readonly<{
  key: string;
  label: string;
  value: number | string;
  unit: MetricUnit;
}>;

export type TrendPoint = Readonly<{
  bucket: string;
  value: number | string;
  series?: string;
}>;

export type DistributionPoint = Readonly<{
  key: string;
  label: string;
  value: number | string;
}>;
