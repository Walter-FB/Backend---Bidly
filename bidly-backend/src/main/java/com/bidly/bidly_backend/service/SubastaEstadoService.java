package com.bidly.bidly_backend.service;

import com.bidly.bidly_backend.model.Subasta;
import com.bidly.bidly_backend.model.SubastaEstadoAdmin;
import com.bidly.bidly_backend.repository.SubastaEstadoAdminRepository;
import com.bidly.bidly_backend.repository.SubastaRepository;
import com.bidly.bidly_backend.repository.SubastaRevisionRepository;
import com.bidly.bidly_backend.repository.SubastaSesionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class SubastaEstadoService {

    public static final String PENDIENTE = "pendiente";
    public static final String ESPERANDO = "esperando";
    public static final String INICIADA = "iniciada";
    public static final String FINALIZADA = "finalizada";

    @Autowired
    private SubastaRepository subastaRepository;

    @Autowired
    private SubastaEstadoAdminRepository estadoAdminRepository;

    @Autowired
    private SubastaRevisionRepository revisionRepository;

    @Autowired
    private SubastaSesionRepository subastaSesionRepository;

    @Autowired
    @Lazy
    private SubastaSesionService subastaSesionService;

    public String estadoSubasta(Long subastaId) {
        return estadoAdminRepository.findById(subastaId)
                .map(SubastaEstadoAdmin::getEstadoSubasta)
                .filter(e -> e != null && !e.isBlank())
                .orElse(PENDIENTE);
    }

    @Transactional
    public void crearEstadoPendiente(Long subastaId) {
        if (estadoAdminRepository.findById(subastaId).isPresent()) {
            return;
        }
        SubastaEstadoAdmin rec = new SubastaEstadoAdmin();
        rec.setSubasta(subastaId);
        rec.setEstado("cerrada");
        rec.setEstadoSubasta(PENDIENTE);
        rec.setAlgunaVezAbierta(false);
        estadoAdminRepository.save(rec);
    }

    /** @deprecated usar {@link #crearEstadoPendiente} */
    @Transactional
    public void crearEstadoEsperando(Long subastaId) {
        crearEstadoPendiente(subastaId);
    }

    @Transactional
    public void pasarAEsperando(Long subastaId) {
        SubastaEstadoAdmin rec = estadoAdminRepository.findById(subastaId).orElse(null);
        if (rec == null) return;
        if (INICIADA.equals(rec.getEstadoSubasta()) || FINALIZADA.equals(rec.getEstadoSubasta())) {
            return;
        }
        rec.setEstadoSubasta(ESPERANDO);
        rec.setEstado("cerrada");
        estadoAdminRepository.save(rec);
    }

    @Transactional
    public void iniciarSubasta(Long subastaId) {
        var revision = revisionRepository.findBySubastaIdentificador(subastaId);
        if (revision.isPresent()
                && !SubastaRevisionService.APROBADA.equals(revision.get().getEstado())) {
            return;
        }

        SubastaEstadoAdmin rec = estadoAdminRepository.findById(subastaId)
                .orElseGet(() -> {
                    SubastaEstadoAdmin n = new SubastaEstadoAdmin();
                    n.setSubasta(subastaId);
                    n.setAlgunaVezAbierta(false);
                    n.setEstadoSubasta(ESPERANDO);
                    return n;
                });

        if (!ESPERANDO.equals(rec.getEstadoSubasta())) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        rec.setEstadoSubasta(INICIADA);
        rec.setEstado("abierta");
        rec.setFechaInicioReal(now);
        rec.setFechaApertura(now);
        rec.setAlgunaVezAbierta(true);
        estadoAdminRepository.save(rec);
        subastaSesionService.iniciarSesion(subastaId);
    }

    @Transactional
    public void finalizarSubasta(Long subastaId) {
        SubastaEstadoAdmin rec = estadoAdminRepository.findById(subastaId)
                .orElseGet(() -> {
                    SubastaEstadoAdmin n = new SubastaEstadoAdmin();
                    n.setSubasta(subastaId);
                    n.setEstadoSubasta(ESPERANDO);
                    return n;
                });

        if (FINALIZADA.equals(rec.getEstadoSubasta())) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        rec.setEstadoSubasta(FINALIZADA);
        rec.setEstado("cerrada");
        rec.setFechaFinalizacion(now);
        estadoAdminRepository.save(rec);
        subastaSesionRepository.findById(subastaId).ifPresent(subastaSesionRepository::delete);
    }

    public String estadoEfectivo(Long subastaId) {
        return estadoAdminRepository.findById(subastaId)
                .map(this::estadoLegacyDesdeAdmin)
                .orElseGet(() -> subastaRepository.findById(subastaId)
                        .map(Subasta::getEstado)
                        .orElse("cerrada"));
    }

    private String estadoLegacyDesdeAdmin(SubastaEstadoAdmin rec) {
        if (INICIADA.equals(rec.getEstadoSubasta())) {
            return "abierta";
        }
        if (rec.getEstado() != null && !rec.getEstado().isBlank()) {
            return rec.getEstado();
        }
        return "cerrada";
    }

    public boolean estaIniciada(Long subastaId) {
        return INICIADA.equals(estadoSubasta(subastaId));
    }

    public boolean estaAbierta(Long subastaId) {
        return estaIniciada(subastaId);
    }

    public void aplicarOverrides(Collection<Subasta> subastas) {
        if (subastas == null || subastas.isEmpty()) return;
        List<Long> ids = subastas.stream().map(Subasta::getIdentificador).toList();
        Map<Long, SubastaEstadoAdmin> overrides = estadoAdminRepository.findBySubastaIn(ids).stream()
                .collect(Collectors.toMap(SubastaEstadoAdmin::getSubasta, r -> r, (a, b) -> a));
        subastas.forEach(s -> {
            SubastaEstadoAdmin r = overrides.get(s.getIdentificador());
            if (r == null) return;
            s.setEstado(estadoLegacyDesdeAdmin(r));
            if (Boolean.TRUE.equals(r.getAlgunaVezAbierta())) {
                s.setAlgunaVezAbierta(true);
            }
            if (r.getFechaApertura() != null) {
                s.setFechaApertura(r.getFechaApertura());
            }
            if (r.getEstadoSubasta() != null) {
                s.setEstadoSubasta(r.getEstadoSubasta());
            }
            if (r.getFechaInicioReal() != null) {
                s.setFechaInicioReal(r.getFechaInicioReal());
            }
        });
    }
}
