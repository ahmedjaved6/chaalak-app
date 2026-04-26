export type UserRole = 'passenger' | 'puller' | 'admin'

export interface User {
  id: string
  email: string
  name: string
  phone: string | null
  role: UserRole
  language_pref: 'as' | 'hi' | 'en'
  created_at: string
}
export type VehicleType = 'rickshaw' | 'auto' | 'bike' | 'car'
export type RideStatus = 'requested' | 'accepted' | 'active' | 'completed' | 'cancelled' | 'expired' | 'no_show'
export type PullerStatus = 'pending' | 'active' | 'suspended'
export type SubscriptionStatus = 'active' | 'inactive' | 'expired'
export type LanguagePref = 'as' | 'hi' | 'en' | 'bn'


export interface Zone {
  id: string
  name: string
  name_as: string
  name_hi: string
  color_hex: string
  color_label: string
  zone_number: number
  is_active: boolean
}

export interface SubZone {
  id: string
  zone_id: string
  name: string
  name_as: string
  name_hi: string
  is_active: boolean
}

export interface Puller {
  id: string
  user_id: string
  badge_code: string
  badge_number: number
  zone_id: string
  is_online: boolean
  lat: number | null
  lng: number | null
  last_active_at: string | null
  total_rides: number
  thumbs_up: number
  status: PullerStatus
  photo_url: string | null
  vehicle_type: VehicleType
}

export interface Passenger {
  id: string
  user_id: string
  total_rides: number
  no_show_count: number
  is_banned: boolean
}

export interface RideRequest {
  id: string
  passenger_id: string
  zone_id: string
  sub_zone_id: string | null
  status: RideStatus
  accepted_by: string | null
  passenger_lat: number | null
  passenger_lng: number | null
  accepted_at: string | null
  started_at: string | null
  completed_at: string | null
  expires_at: string | null
  thumbs_up: boolean | null
  created_at: string
}

export interface Subscription {
  id: string
  puller_id: string
  status: SubscriptionStatus
  valid_from: string
  valid_till: string
  amount: number
}

export interface FareRule {
  id: string
  from_zone_id: string
  to_zone_id: string
  vehicle_type: VehicleType
  fare_min: number
  fare_max: number
  updated_at: string
}

