import type {
  AccountData,
  ChatRoomData,
  DemoReview,
  Ride,
  Role,
  RouteData,
  ScheduleItem,
  SafetyReport,
  BlockedUser,
  ReportTarget,
  HistoryEntry,
  ProfileBadge,
  NotificationSettings,
  DemoDevice,
  FaqItem,
} from "../types/domain"

export const defaultAccount: AccountData = {
  name: "",
  id: "",
  email: "",
  phone: "",
  gender: "선택 안 함",
}

export const defaultRoutes: Record<Role, RouteData> = {
  rider: {
    start: "",
    destination: "",
    waypoint: "",
    pickup: "",
    weekdays: ["월", "화", "수", "목", "금"],
    departureTime: "08:30",
    preferredArrival: "09:00",
    smokingPreference: "비흡연자 선호",
    genderPreference: "성별 무관",
  },
  driver: {
    start: "",
    destination: "",
    waypoint: "",
    pickup: "",
    weekdays: ["월", "화", "수", "목", "금"],
    departureTime: "08:30",
    preferredArrival: "09:00",
    smokingPreference: "비흡연자 선호",
    genderPreference: "성별 무관",
  },
}

export const demoRides: Ride[] = []

export const demoWeek = [
  ["월", "17"],
  ["화", "18"],
  ["수", "19"],
  ["목", "20"],
  ["금", "21"],
] as const

export const demoChatRooms: ChatRoomData[] = []

export const demoReceivedReviews: DemoReview[] = []

export const demoScheduleByDate: Record<string, ScheduleItem[]> = {}

export const demoReportTargets: ReportTarget[] = []

export const defaultSafetyReports: SafetyReport[] = []

export const defaultBlockedUsers: BlockedUser[] = []

export const demoHistoryEntries: HistoryEntry[] = []

export const demoProfileBadges: ProfileBadge[] = [
  {
    id: "driver-veteran",
    role: "driver",
    label: "베테랑 드라이버",
    condition: "카풀 운행 횟수 50회 이상 달성",
    icon: "car",
    tone: "navy",
  },
  {
    id: "driver-license",
    role: "driver",
    label: "면허 인증 완료",
    condition: "운전면허증 및 차량 정보 확인",
    icon: "check",
    tone: "green",
  },
  {
    id: "driver-safe",
    role: "driver",
    label: "무사고 드라이버",
    condition: "최근 6개월 사고 및 패널티 신고 0건",
    icon: "shield",
    tone: "sky",
  },
  {
    id: "driver-five-star",
    role: "driver",
    label: "5성급 기사님",
    condition: "탑승자 평가 평균 별점 4.8 이상",
    icon: "star",
    tone: "orange",
  },
  {
    id: "driver-mood",
    role: "driver",
    label: "분위기 메이커",
    condition: "대화와 선곡 관련 긍정 후기 다수 획득",
    icon: "music",
    tone: "green",
  },
  {
    id: "rider-student",
    role: "rider",
    label: "학생증 인증 완료",
    condition: "신구대학교 웹메일 인증",
    icon: "student",
    tone: "navy",
  },
  {
    id: "rider-punctual",
    role: "rider",
    label: "시간 칼약속",
    condition: "시간을 잘 지켜요 후기 다수 획득",
    icon: "clock",
    tone: "orange",
  },
  {
    id: "rider-manner",
    role: "rider",
    label: "매너 탑승객",
    condition: "평균 별점 4.8 이상 및 친절 키워드 획득",
    icon: "manner",
    tone: "green",
  },
  {
    id: "rider-commuter",
    role: "rider",
    label: "프로 통학러",
    condition: "카풀 탑승 횟수 50회 이상 달성",
    icon: "commute",
    tone: "sky",
  },
]

export const defaultSelectedBadges: Record<Role, string[]> = {
  driver: [],
  rider: [],
}

export const defaultNotificationSettings: NotificationSettings = {
  matching: true,
  trip: true,
  chat: true,
  marketing: false,
}

export const defaultDemoDevices: DemoDevice[] = []

export const serviceFaqs: FaqItem[] = [
  {
    id: "faq-apply",
    question: "카풀 신청은 어떻게 하나요?",
    answer:
      "홈 화면에서 출발지와 도착지, 희망 시간을 확인한 뒤 등록된 카풀을 선택하고 신청할 수 있습니다. 신청 이후에는 일정 또는 신청 내역에서 진행 상태를 확인하세요.",
  },
  {
    id: "faq-approval",
    question: "카풀 신청이 승인되었는지 어떻게 확인하나요?",
    answer:
      "카풀 신청 내역에서 신청 상태를 확인할 수 있습니다. 승인된 경우 채팅을 통해 탑승 장소와 시간을 조율하세요.",
  },
  {
    id: "faq-cancel",
    question: "신청한 카풀을 취소할 수 있나요?",
    answer:
      "신청 상태와 운행 진행 상황에 따라 취소 가능 여부가 달라질 수 있습니다. 운행 시작 전 신청 내역에서 취소할 수 있습니다.",
  },
  {
    id: "faq-driver",
    question: "운전자로 카풀을 등록하려면 어떻게 해야 하나요?",
    answer:
      "운전자 프로필과 차량 정보를 입력한 뒤 실제 운행 가능한 경로, 시간, 좌석 수를 등록하세요.",
  },
  {
    id: "faq-chat",
    question: "채팅 알림이 오지 않아요.",
    answer:
      "알림 설정 화면에서 전체 알림과 채팅 알림이 켜져 있는지 확인하세요.",
  },
  {
    id: "faq-mileage",
    question: "마일리지는 어떻게 적립되나요?",
    answer:
      "운행 완료 및 정산 시 운전자에게 마일리지가 자동으로 적립됩니다.",
  },
  {
    id: "faq-privacy",
    question: "개인정보는 어떻게 보호하나요?",
    answer:
      "비밀번호를 다른 사람에게 알려주지 마세요. 채팅에서 불필요한 개인정보를 공유하지 말고, 문제 발생 시 안전 신고 기능을 이용하세요.",
  },
  {
    id: "faq-contact",
    question: "문제가 발생하면 어디로 문의하나요?",
    answer:
      "설정 화면의 고객센터 및 1:1 문의하기에서 문의 내용을 접수할 수 있습니다.",
  },
]

export const APP_VERSION = "1.0.0"
