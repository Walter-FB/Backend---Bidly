package com.bidly.bidly_backend.service;

import com.bidly.bidly_backend.model.ItemCatalogo;
import com.bidly.bidly_backend.model.Subasta;
import com.bidly.bidly_backend.model.SubastaSesion;
import com.bidly.bidly_backend.repository.ItemCatalogoRepository;
import com.bidly.bidly_backend.repository.SubastaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class AuctionFinalizerService {

    @Autowired private ItemCatalogoRepository itemCatalogoRepository;
    @Autowired private SubastaRepository subastaRepository;
    @Autowired private SubastaEstadoService subastaEstadoService;
    @Autowired private SubastaService subastaService;
    @Autowired private ItemAdjudicacionService itemAdjudicacionService;
    @Autowired private SubastaSesionService subastaSesionService;

    @Scheduled(fixedDelay = 60000)
    public void finalizarItemsVencidos() {
        LocalDateTime ahora = LocalDateTime.now();
        List<Subasta> abiertas = subastaRepository.findAbiertasEfectivas();
        subastaEstadoService.aplicarOverrides(abiertas);

        for (Subasta subasta : abiertas) {
            Optional<SubastaSesion> sesionOpt = subastaSesionService.obtenerSesion(subasta.getIdentificador());
            if (sesionOpt.isEmpty()) continue;
            if (!subastaService.inactividadVencida(subasta, ahora)) continue;

            Long itemActivoId = sesionOpt.get().getItemActivo();
            itemAdjudicacionService.finalizarItem(itemActivoId, true);
        }

        cerrarSubastasCompletasAbiertas();
    }

    private void cerrarSubastasCompletasAbiertas() {
        for (Subasta subasta : subastaRepository.findAbiertasEfectivas()) {
            if (subastaSesionService.obtenerSesion(subasta.getIdentificador()).isPresent()) continue;
            List<ItemCatalogo> items = itemCatalogoRepository
                    .findByCatalogoSubastaIdentificador(subasta.getIdentificador());
            if (items.isEmpty()) continue;
            boolean todos = items.stream().allMatch(i -> "si".equals(i.getSubastado()));
            if (todos) {
                subastaEstadoService.finalizarSubasta(subasta.getIdentificador());
            }
        }
    }
}
