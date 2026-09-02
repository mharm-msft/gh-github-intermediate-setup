import { Classroom } from '../src/types'

export const TEST_CLASSROOM: Classroom = {
  githubServer: 'https://github.com',
  organization: 'test-org',
  customerName: 'Test Customer',
  customerAbbr: 'TC',
  administrators: ['admin1', 'admin2'],
  attendees: ['admin1', 'attendee1', 'attendee2'],
  provisioned: ['admin1', 'admin2', 'attendee1', 'attendee2'],
  pending: []
}
