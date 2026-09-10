async function sendRecap() {
    setSending(true)
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()

      const sectionsData = {
        coachedSessions: recapSections.coachedSessions ? { week: sessionStats.week, month: sessionStats.month, year: sessionStats.year, weekly: sessionStats.weekly } : null,
        soloSessions: recapSections.soloSessions ? { week: soloStats.week, month: soloStats.month, year: soloStats.year, weekly: soloStats.weekly } : null,
        upcomingSessions: recapSections.upcomingSessions ? upcoming : null,
        loadProgression: recapSections.loadProgression ? sessions.map(s => ({ name: s.name, exercises: s.exercises.map(e => ({ name: e.name, week_loads: e.week_loads })) })) : null,
        bodyMetrics: recapSections.bodyMetrics && metrics.length > 0 ? metrics[0] : null
      }

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-recap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession.access_token}`
        },
        body: JSON.stringify({
          clientId: client.id,
          clientEmail: client.email,
          clientName: client.full_name,
          personalNote,
          summary: recapSummary,
          sectionsData
        })
      })

      if (!res.ok) throw new Error(await res.text())

      toast.success('Training in Review sent!')
      setShowRecap(false)
      setPreviewMode(false)
      setPersonalNote('')
      setRecapSummary('')
    } catch (e) {
      toast.error('Failed to send')
      console.error(e)
    } finally {
      setSending(false)
    }
  }