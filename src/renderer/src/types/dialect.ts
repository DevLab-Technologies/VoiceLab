export type DialectCode =
  | 'MSA'
  | 'SAU'
  | 'UAE'
  | 'ALG'
  | 'IRQ'
  | 'EGY'
  | 'MAR'
  | 'OMN'
  | 'TUN'
  | 'LEV'
  | 'SDN'
  | 'LBY'

export interface DialectInfo {
  code: DialectCode
  nameAr: string
  nameEn: string
}
